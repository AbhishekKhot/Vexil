import { Repository } from "typeorm";
import { EvaluationResult, StrategyConfig, StrategyValidationError } from "./EvaluationStrategy.interface";
import { StrategyFactory } from "./StrategyFactory";
import { FlagEnvironmentConfig } from "../entities/FlagEnvironmentConfig";

// Guards against infinite loops when flags depend on each other as prerequisites.
const MAX_PREREQUISITE_DEPTH = 3;

export interface FlagEvaluationOutput {
    value: unknown;
    type: string;
    variant?: string;
    reason: string;
}

export class EvaluationEngine {
    constructor(private readonly configRepo: Repository<FlagEnvironmentConfig>) {}

    /**
     * Evaluates all flag configs for an environment against the given context.
     * Each flag is evaluated independently — an error on one flag does not block others.
     * depth tracks prerequisite recursion to enforce MAX_PREREQUISITE_DEPTH.
     */
    async evaluate(configs: FlagEnvironmentConfig[], context: Record<string, unknown>, depth = 0): Promise<{ flags: Record<string, FlagEvaluationOutput> }> {
        const flags: Record<string, FlagEvaluationOutput> = {};
        for (const config of configs) {
            const flagKey = config.flag.key;
            try {
                const result = await this.evaluateSingle(config, context, depth);
                flags[flagKey] = { value: result.value, type: config.flag.type, variant: result.variant, reason: result.reason };
            } catch (err) {
                // Isolate failures — return ERROR reason instead of crashing the whole batch.
                flags[flagKey] = { value: false, type: config.flag.type, reason: "ERROR" };
                console.error(`[EvaluationEngine] Error evaluating "${flagKey}": ${err instanceof Error ? err.message : err}`);
            }
        }
        return { flags };
    }

    /** Resolves the strategy config, instantiates the strategy, and runs evaluate(). */
    private async evaluateSingle(config: FlagEnvironmentConfig, context: Record<string, unknown>, depth: number): Promise<EvaluationResult> {
        const strategyConfig = this.resolveStrategyConfig(config);
        const strategy = StrategyFactory.create({
            strategyConfig,
            isEnabled: config.isEnabled,
            flagKey: config.flag.key,
            // Only wire up the prerequisite evaluator if we haven't hit the depth limit.
            // Passing undefined at the limit causes PrerequisiteStrategy to throw,
            // which the caller catches and returns ERROR reason.
            prerequisiteEvaluator: depth < MAX_PREREQUISITE_DEPTH
                ? async (flagKey, ctx) => {
                    const prereqConfig = await this.configRepo.findOne({
                        where: { flag: { key: flagKey }, environment: { id: config.environment.id } },
                        relations: ["flag", "environment"],
                    });
                    if (!prereqConfig) return null;
                    return this.evaluateSingle(prereqConfig, ctx, depth + 1);
                }
                : undefined,
        });
        return strategy.evaluate(context);
    }

    /**
     * Merges strategyType + strategyConfig from the DB row into a single typed object for parsing.
     * Falls back to boolean (always-off) if the stored config is invalid — prevents one bad
     * config from crashing evaluation for all flags.
     */
    private resolveStrategyConfig(config: FlagEnvironmentConfig): StrategyConfig {
        const rawType = config.strategyType ?? "boolean";
        const rawCfg = config.strategyConfig ?? {};
        try {
            return StrategyFactory.parse({ strategyType: rawType, ...rawCfg });
        } catch {
            return { strategyType: "boolean" };
        }
    }
}
