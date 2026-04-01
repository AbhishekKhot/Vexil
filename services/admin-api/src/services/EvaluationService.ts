import { Repository } from "typeorm";
import Redis from "ioredis";
import { Environment } from "../entities/Environment";
import { FlagEnvironmentConfig } from "../entities/FlagEnvironmentConfig";
import { EvaluationEvent } from "../entities/EvaluationEvent";
import { evaluateRules } from "../utils/ruleEngine";

export class EvaluationService {
    constructor(
        private environmentRepo: Repository<Environment>,
        private configRepo: Repository<FlagEnvironmentConfig>,
        private eventRepo: Repository<EvaluationEvent>,
        private redisClient: Redis
    ) {}

    async getEnvironmentByApiKey(apiKey: string): Promise<Environment | null> {
        return await this.environmentRepo.findOne({
            where: { apiKey },
            relations: ["project"]
        });
    }

    private async redisGet(key: string): Promise<string | null> {
        try {
            return await this.redisClient.get(key);
        } catch {
            return null; // Redis unavailable — fall through to DB
        }
    }

    private async redisSet(key: string, value: string, ttl: number): Promise<void> {
        try {
            await this.redisClient.set(key, value, "EX", ttl);
        } catch {
            // Redis unavailable — skip caching, not fatal
        }
    }

    async evaluateFlags(apiKey: string, context?: Record<string, any>): Promise<Record<string, any>> {
        // 1. Validate API key & fetch environment
        const environment = await this.getEnvironmentByApiKey(apiKey);
        if (!environment) throw new Error("Invalid API Key");

        // 2. Fetch raw FlagEnvironmentConfigs — try cache first
        const cacheKey = `env_configs:${apiKey}`;
        let configs: FlagEnvironmentConfig[];

        const cached = await this.redisGet(cacheKey);
        if (cached) {
            configs = JSON.parse(cached);
        } else {
            configs = await this.configRepo.find({
                where: { environment: { id: environment.id } },
                relations: ["flag"]
            });
            // Cache raw configs for 60s (context-independent, rules evaluated in-memory)
            await this.redisSet(cacheKey, JSON.stringify(configs), 60);
        }

        // 3. Evaluate each flag — apply rule engine when context is provided
        const evaluated: Record<string, any> = {};
        const events: Partial<EvaluationEvent>[] = [];

        for (const config of configs) {
            let value: boolean = config.isEnabled;
            const ctx = context || {};

            // Apply rules only when flag is ON (rules refine who gets it)
            if (config.isEnabled && config.rules) {
                const ruleResult = evaluateRules(config.rules, ctx);
                if (ruleResult !== null) {
                    value = ruleResult; // Override: rules determine final result
                }
            }

            evaluated[config.flag.key] = {
                value,
                type: config.flag.type
            };

            events.push({
                environmentId: environment.id,
                flagKey: config.flag.key,
                result: value,
                context: context ? context : undefined
            });
        }

        // 4. Log evaluation events asynchronously (fire-and-forget, non-blocking)
        if (events.length > 0) {
            this.eventRepo.insert(events).catch(() => {
                // Silently fail — never block evaluation for analytics
            });
        }

        return evaluated;
    }

    async invalidateEnvironmentCache(apiKey: string): Promise<void> {
        try {
            await this.redisClient.del(`env_configs:${apiKey}`);
        } catch {
            // Ignore
        }
    }
}
