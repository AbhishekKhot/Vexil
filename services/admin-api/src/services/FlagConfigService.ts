import { Repository } from "typeorm";
import { FlagEnvironmentConfig } from "../entities/FlagEnvironmentConfig";
import { Flag } from "../entities/Flag";
import { Environment } from "../entities/Environment";
import { StrategyConfig, StrategyValidationError } from "../evaluation/EvaluationStrategy.interface";
import { StrategyFactory } from "../evaluation/StrategyFactory";

export interface SetFlagConfigInput {
    flag: Flag;
    environment: Environment;
    isEnabled: boolean;
    strategyType?: string;
    strategyConfig?: Record<string, unknown>;
    /** @deprecated Use strategyConfig with attribute_matching strategy instead */
    rules?: unknown;
}

export class FlagConfigService {
    constructor(private readonly configRepo: Repository<FlagEnvironmentConfig>) {}

    async getFlagConfig(flagId: string, environmentId: string): Promise<FlagEnvironmentConfig | null> {
        return await this.configRepo.findOne({
            where: { flag: { id: flagId }, environment: { id: environmentId } },
            relations: ["flag", "environment"],
        });
    }

    async setFlagConfig(input: SetFlagConfigInput): Promise<FlagEnvironmentConfig> {
        const { flag, environment, isEnabled, strategyType, strategyConfig, rules } = input;

        // Validate strategy config if provided
        let parsedStrategy: StrategyConfig | undefined;
        if (strategyType && strategyType !== "boolean") {
            parsedStrategy = StrategyFactory.parse({ strategyType, ...strategyConfig });
        } else if (strategyType === "boolean") {
            parsedStrategy = { strategyType: "boolean" };
        }

        let config = await this.getFlagConfig(flag.id, environment.id);

        if (!config) {
            config = this.configRepo.create({
                flag,
                environment,
                isEnabled,
                strategyType: (parsedStrategy?.strategyType ?? "boolean") as string,
                strategyConfig: (strategyConfig ?? null) as any,
                rules: (rules ?? null) as any,
            });
        } else {
            config.isEnabled = isEnabled;

            if (parsedStrategy) {
                config.strategyType = parsedStrategy.strategyType;
                // Strip the strategyType field from the stored config blob
                const { strategyType: _t, ...rest } = strategyConfig ?? {};
                config.strategyConfig = Object.keys(rest).length > 0
                    ? rest as Record<string, unknown>
                    : undefined;
            }

            // Legacy rules field update
            if (rules !== undefined) {
                config.rules = rules;
            }
        }

        return await this.configRepo.save(config);
    }
}
