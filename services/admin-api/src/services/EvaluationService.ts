import { Repository } from "typeorm";
import Redis from "ioredis";
import { Environment } from "../entities/Environment";
import { FlagEnvironmentConfig } from "../entities/FlagEnvironmentConfig";

export class EvaluationService {
    constructor(
        private environmentRepo: Repository<Environment>,
        private configRepo: Repository<FlagEnvironmentConfig>,
        private redisClient: Redis
    ) {}

    async getEnvironmentByApiKey(apiKey: string): Promise<Environment | null> {
        return await this.environmentRepo.findOne({
            where: { apiKey },
            relations: ["project"]
        });
    }

    async evaluateFlags(apiKey: string, context?: any): Promise<Record<string, any>> {
        const cacheKey = `env_flags:${apiKey}`;
        
        // 1. Try Cache
        const cached = await this.redisClient.get(cacheKey);
        if (cached) {
            return JSON.parse(cached);
        }

        // 2. Fetch Environment
        const environment = await this.getEnvironmentByApiKey(apiKey);
        if (!environment) {
            throw new Error("Invalid API Key");
        }

        // 3. Fetch Flag Configs for this environment
        const configs = await this.configRepo.find({
            where: { environment: { id: environment.id } },
            relations: ["flag"]
        });

        // 4. Basic Boolean Evaluation (Segment/Rules logic extension point here)
        const evaluated: Record<string, any> = {};
        for (const config of configs) {
            evaluated[config.flag.key] = {
                value: config.isEnabled,
                type: config.flag.type // Added for rich SDK typing
            };
        }

        // 5. Store in Cache (e.g. 1 minute TTL for quick dev cycle)
        await this.redisClient.set(cacheKey, JSON.stringify(evaluated), "EX", 60);

        return evaluated;
    }

    async invalidateEnvironmentCache(apiKey: string): Promise<void> {
        await this.redisClient.del(`env_flags:${apiKey}`);
    }
}
