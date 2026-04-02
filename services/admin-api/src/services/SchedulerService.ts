import { Repository, LessThanOrEqual } from "typeorm";
import { FlagEnvironmentConfig } from "../entities/FlagEnvironmentConfig";
import Redis from "ioredis";

export class SchedulerService {
    private timer: NodeJS.Timeout | null = null;

    constructor(
        private readonly configRepo: Repository<FlagEnvironmentConfig>,
        private readonly redisClient?: Redis
    ) {}

    start() {
        if (this.timer) return;
        // Check every 60 seconds
        this.timer = setInterval(() => this.checkScheduledChanges(), 60_000);
        // Also check immediately on start
        setTimeout(() => this.checkScheduledChanges(), 1000);
    }

    stop() {
        if (this.timer) {
            clearInterval(this.timer);
            this.timer = null;
        }
    }

    private async checkScheduledChanges() {
        try {
            const now = new Date();
            const dueConfigs = await this.configRepo.find({
                where: {
                    scheduledAt: LessThanOrEqual(now)
                },
                relations: ["environment"]
            });

            if (dueConfigs.length === 0) return;

            for (const config of dueConfigs) {
                if (!config.scheduledConfig) {
                    config.scheduledAt = undefined;
                    await this.configRepo.save(config);
                    continue;
                }

                const { isEnabled, strategyType, strategyConfig, rules } = config.scheduledConfig as any;
                
                if (isEnabled !== undefined) config.isEnabled = isEnabled;
                if (strategyType !== undefined) config.strategyType = strategyType;
                if (strategyConfig !== undefined) config.strategyConfig = strategyConfig;
                if (rules !== undefined) config.rules = rules;
                
                config.scheduledAt = undefined;
                // @ts-ignore
                config.scheduledConfig = null;

                await this.configRepo.save(config);
                
                // Invalidate cache
                if (config.environment?.id && this.redisClient) {
                    try {
                        await this.redisClient.del(`env_configs:${config.environment.id}`);
                    } catch (e) {
                        console.error("Failed to invalidate cache", e);
                    }
                }
            }
        } catch (err) {
            console.error("Error in SchedulerService:", err);
        }
    }
}
