import { Repository, LessThanOrEqual } from "typeorm";
import { FlagEnvironmentConfig } from "../entities/FlagEnvironmentConfig";
import Redis from "ioredis";

/**
 * Polls every 60s for flag configs with a scheduledAt date that has passed,
 * then applies the pending config change and clears the schedule.
 * Runs an initial check 1s after startup to catch any overdue configs from a restart.
 */
export class SchedulerService {
    private timer: NodeJS.Timeout | null = null;

    constructor(private readonly configRepo: Repository<FlagEnvironmentConfig>, private readonly redis?: Redis) { }

    start() {
        if (this.timer) return;
        this.timer = setInterval(() => this.checkScheduledChanges(), 60_000);
        setTimeout(() => this.checkScheduledChanges(), 1000);
    }

    stop() {
        if (this.timer) { clearInterval(this.timer); this.timer = null; }
    }

    /**
     * Finds all configs where scheduledAt <= now, applies the scheduledConfig fields,
     * then clears scheduledAt so the config isn't processed again.
     * Busts the Redis cache for each environment so the new config is picked up immediately.
     */
    private async checkScheduledChanges() {
        try {
            const dueConfigs = await this.configRepo.find({ where: { scheduledAt: LessThanOrEqual(new Date()) }, relations: ["environment"] });
            for (const config of dueConfigs) {
                if (!config.scheduledConfig) { config.scheduledAt = undefined; await this.configRepo.save(config); continue; }
                const { isEnabled, strategyType, strategyConfig } = config.scheduledConfig as any;
                if (isEnabled !== undefined) config.isEnabled = isEnabled;
                if (strategyType !== undefined) config.strategyType = strategyType;
                if (strategyConfig !== undefined) config.strategyConfig = strategyConfig;
                config.scheduledAt = undefined;
                (config as any).scheduledConfig = null;
                await this.configRepo.save(config);
                if (config.environment ?.id && this.redis)
                    this.redis.del(`env_configs:${config.environment.id}`).catch(() => { });
            }
        } catch (err) {
            console.error("[SchedulerService]", err);
        }
    }
}
