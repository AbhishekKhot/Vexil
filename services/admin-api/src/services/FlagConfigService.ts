import { Repository } from "typeorm";
import { FlagEnvironmentConfig } from "../entities/FlagEnvironmentConfig";
import { Flag } from "../entities/Flag";
import { Environment } from "../entities/Environment";
import { StrategyConfig, StrategyValidationError } from "../evaluation/EvaluationStrategy.interface";
import { StrategyFactory } from "../evaluation/StrategyFactory";
import Redis from "ioredis";

export interface SetFlagConfigInput {
    flag: Flag;
    environment: Environment;
    isEnabled: boolean;
    strategyType?: string;
    strategyConfig?: Record<string, unknown>;
    /** @deprecated Use strategyConfig with attribute_matching strategy instead */
    rules?: unknown;
    scheduledAt?: string | null;
    scheduledConfig?: Record<string, unknown> | null;
}

export class FlagConfigService {
    constructor(
        private readonly configRepo: Repository<FlagEnvironmentConfig>,
        private readonly redisClient: Redis
    ) {}

    async getFlagConfig(flagId: string, environmentId: string): Promise<FlagEnvironmentConfig | null> {
        return await this.configRepo.findOne({
            where: { flag: { id: flagId }, environment: { id: environmentId } },
            relations: ["flag", "environment"],
        });
    }

    async setFlagConfig(input: SetFlagConfigInput): Promise<FlagEnvironmentConfig> {
        const { flag, environment, isEnabled, strategyType, strategyConfig, rules, scheduledAt, scheduledConfig } = input;

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
                scheduledAt: scheduledAt ? new Date(scheduledAt) : undefined,
                scheduledConfig: (scheduledConfig ?? null) as any,
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

            if (scheduledAt !== undefined) {
                config.scheduledAt = scheduledAt ? new Date(scheduledAt) : undefined;
                config.scheduledConfig = (scheduledConfig ?? null) as any;
            }
        }

        const savedConfig = await this.configRepo.save(config);

        if (this.redisClient && environment.id) {
            try {
                await this.redisClient.del(`env_configs:${environment.id}`);
            } catch (e) {
                console.error("Failed to invalidate cache", e);
            }
        }

        return savedConfig;
    }
}
