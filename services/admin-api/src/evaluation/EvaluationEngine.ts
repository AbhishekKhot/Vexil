/**
 * Evaluation Engine
 *
 * Orchestrates flag evaluation for a full set of FlagEnvironmentConfigs.
 * Responsibilities:
 *   1. For each config, resolve the correct strategy via StrategyFactory
 *   2. Execute the strategy's evaluate() with the provided context
 *   3. Normalize the result into a consistent FlagEvaluationOutput shape
 *   4. Guard prerequisite recursion depth
 *
 * This class has NO knowledge of HTTP, Redis, or DB — those concerns
 * live in EvaluationService. Pure evaluation logic only.
 */

import { Repository } from "typeorm";
import {
    EvaluationResult,
    StrategyConfig,
    StrategyValidationError,
} from "./EvaluationStrategy.interface";
import { StrategyFactory } from "./StrategyFactory";
import { FlagEnvironmentConfig } from "../entities/FlagEnvironmentConfig";

const MAX_PREREQUISITE_DEPTH = 3;

export interface FlagEvaluationOutput {
    value: unknown;
    type: string;       // from Flag.type: "boolean" | "string" | "number" | "json"
    variant?: string;   // populated for ab_test strategy
    reason: string;     // EvaluationReason code for debugging
}

export interface EvaluationEngineResult {
    flags: Record<string, FlagEvaluationOutput>;
}

export class EvaluationEngine {
    constructor(
        /** Needed for prerequisite lookups — engine looks up sibling flag configs */
        private readonly configRepo: Repository<FlagEnvironmentConfig>
    ) {}

    /**
     * Evaluates all flags in the given configs array for the provided context.
     * Returns a map of flagKey → FlagEvaluationOutput.
     */
    async evaluate(
        configs: FlagEnvironmentConfig[],
        context: Record<string, unknown>,
        depth = 0
    ): Promise<EvaluationEngineResult> {
        const flags: Record<string, FlagEvaluationOutput> = {};

        for (const config of configs) {
            const flagKey = config.flag.key;
            try {
                const result = await this.evaluateSingle(config, context, depth);
                flags[flagKey] = {
                    value: result.value,
                    type: config.flag.type,
                    variant: result.variant,
                    reason: result.reason,
                };
            } catch (err) {
                // Individual flag errors are isolated — never fail the whole batch
                const message = err instanceof Error ? err.message : "Unknown error";
                flags[flagKey] = {
                    value: false,
                    type: config.flag.type,
                    reason: "ERROR",
                };
                console.error(`[EvaluationEngine] Error evaluating flag "${flagKey}": ${message}`);
            }
        }

        return { flags };
    }

    private async evaluateSingle(
        config: FlagEnvironmentConfig,
        context: Record<string, unknown>,
        depth: number
    ): Promise<EvaluationResult> {
        const strategyConfig = this.resolveStrategyConfig(config);

        const strategy = StrategyFactory.create({
            strategyConfig,
            isEnabled: config.isEnabled,
            flagKey: config.flag.key,
            prerequisiteEvaluator: depth < MAX_PREREQUISITE_DEPTH
                ? this.buildPrerequisiteEvaluator(config.environment.id, context, depth)
                : undefined,
        });

        return await strategy.evaluate(context);
    }

    /**
     * Resolves the StrategyConfig from a FlagEnvironmentConfig row.
     * Falls back to "boolean" for legacy rows with no strategyType set.
     */
    private resolveStrategyConfig(config: FlagEnvironmentConfig): StrategyConfig {
        const rawType = config.strategyType ?? "boolean";
        const rawCfg  = config.strategyConfig ?? {};

        try {
            return StrategyFactory.parse({ strategyType: rawType, ...rawCfg });
        } catch {
            // Corrupt config — fall back to kill switch using isEnabled
            return { strategyType: "boolean" };
        }
    }

    /**
     * Builds a closure that recursively evaluates a prerequisite flag.
     * The depth counter prevents infinite loops (max 3 hops).
     */
    private buildPrerequisiteEvaluator(
        environmentId: string,
        context: Record<string, unknown>,
        depth: number
    ) {
        return async (flagKey: string, ctx: Record<string, unknown>): Promise<EvaluationResult | null> => {
            const prereqConfig = await this.configRepo.findOne({
                where: {
                    flag: { key: flagKey },
                    environment: { id: environmentId },
                },
                relations: ["flag", "environment"],
            });

            if (!prereqConfig) return null;

            return await this.evaluateSingle(prereqConfig, ctx, depth + 1);
        };
    }
}
