import { Repository } from "typeorm";
import Redis from "ioredis";
import { Environment } from "../entities/Environment";
import { FlagEnvironmentConfig } from "../entities/FlagEnvironmentConfig";
import { EvaluationEngine, FlagEvaluationOutput } from "../evaluation/EvaluationEngine";

export class EvaluationService {
    private readonly engine: EvaluationEngine;

    constructor(
        private readonly environmentRepo: Repository<Environment>,
        private readonly configRepo: Repository<FlagEnvironmentConfig>,
        private readonly redis: Redis
    ) {
        this.engine = new EvaluationEngine(configRepo);
    }

    /**
     * Main data-plane entry point — resolves the environment by API key, loads its flag configs
     * (from Redis cache if available), and evaluates all flags.
     */
    async evaluateFlags(apiKey: string, context?: Record<string, unknown>): Promise<Record<string, FlagEvaluationOutput>> {
        const environment = await this.getEnvironmentByApiKey(apiKey);
        if (!environment) throw new Error("Invalid API Key");

        // Cache flag configs for 30s to avoid a DB hit on every SDK poll cycle.
        // FlagConfigService busts this key whenever a config is saved.
        const cacheKey = `env_configs:${environment.id}`;
        let configs: FlagEnvironmentConfig[];
        const cached = await this.redis.get(cacheKey).catch(() => null);
        if (cached) {
            configs = JSON.parse(cached) as FlagEnvironmentConfig[];
        } else {
            configs = await this.configRepo.find({ where: { environment: { id: environment.id } }, relations: ["flag", "environment"] });
            this.redis.set(cacheKey, JSON.stringify(configs), "EX", 30).catch(() => { });
        }

        const { flags } = await this.engine.evaluate(configs, context ?? {});
        return flags;
    }

    /**
     * Resolves an environment from its API key.
     * Cached for 5 minutes since API keys rarely change — avoids a DB lookup on every request.
     */
    private async getEnvironmentByApiKey(apiKey: string): Promise<Environment | null> {
        const cacheKey = `env_apikey:${apiKey}`;
        const cached = await this.redis.get(cacheKey).catch(() => null);
        if (cached) return JSON.parse(cached) as Environment;
        const env = await this.environmentRepo.findOne({ where: { apiKey }, relations: ["project"] });
        if (env) this.redis.set(cacheKey, JSON.stringify(env), "EX", 300).catch(() => { });
        return env;
    }
}
