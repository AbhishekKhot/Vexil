import { Repository } from "typeorm";
import { FlagEnvironmentConfig } from "../entities/FlagEnvironmentConfig";
import { Flag } from "../entities/Flag";
import { Environment } from "../entities/Environment";
import { StrategyConfig } from "../evaluation/EvaluationStrategy.interface";
import { StrategyFactory } from "../evaluation/StrategyFactory";
import Redis from "ioredis";

export interface SetFlagConfigInput {
    flag: Flag; environment: Environment; isEnabled: boolean;
    strategyType?: string; strategyConfig?: Record<string, unknown>;
    scheduledAt?: string | null; scheduledConfig?: Record<string, unknown> | null;
}

export class FlagConfigService {
    constructor(private readonly configRepo: Repository<FlagEnvironmentConfig>, private readonly redis: Redis) {}

    async getFlagConfig(flagId: string, environmentId: string): Promise<FlagEnvironmentConfig | null> {
        return this.configRepo.findOne({ where: { flag: { id: flagId }, environment: { id: environmentId } }, relations: ["flag","environment"] });
    }

    /**
     * Upserts a flag's config for a specific environment.
     * Validates the strategy via StrategyFactory.parse() before saving — throws 400 if invalid.
     * After saving, invalidates the Redis cache for this environment so the next evaluation
     * fetches fresh data instead of serving the old cached config.
     * strategyType is stored as a DB column; strategyConfig excludes strategyType to avoid redundancy.
     */
    async setFlagConfig(input: SetFlagConfigInput): Promise<FlagEnvironmentConfig> {
        const { flag, environment, isEnabled, strategyType, strategyConfig, scheduledAt, scheduledConfig } = input;

        let parsedStrategy: StrategyConfig | undefined;
        if (strategyType && strategyType !== "boolean") {
            parsedStrategy = StrategyFactory.parse({ strategyType, ...strategyConfig });
        } else if (strategyType === "boolean") {
            parsedStrategy = { strategyType: "boolean" };
        }

        let config = await this.getFlagConfig(flag.id, environment.id);
        if (!config) {
            config = this.configRepo.create({
                flag, environment, isEnabled,
                strategyType: (parsedStrategy?.strategyType ?? "boolean") as string,
                strategyConfig: strategyConfig as any ?? undefined,
                scheduledAt: scheduledAt ? new Date(scheduledAt) : undefined,
                scheduledConfig: scheduledConfig as any ?? undefined,
            });
        } else {
            config.isEnabled = isEnabled;
            if (parsedStrategy) {
                config.strategyType = parsedStrategy.strategyType;
                // Strip strategyType from the JSONB column — it's already in the dedicated column.
                const { strategyType: _t, ...rest } = strategyConfig ?? {};
                config.strategyConfig = Object.keys(rest).length > 0 ? rest as Record<string, unknown> : undefined;
            }
            if (scheduledAt !== undefined) {
                config.scheduledAt = scheduledAt ? new Date(scheduledAt) : undefined;
                config.scheduledConfig = scheduledConfig as any ?? undefined;
            }
        }

        const saved = await this.configRepo.save(config);
        // M4: Await cache bust — fire-and-forget could serve a stale config for up to 30s
        // if the del silently fails right after a save.
        await this.redis.del(`env_configs:${environment.id}`).catch(() => {});
        return saved;
    }
}
