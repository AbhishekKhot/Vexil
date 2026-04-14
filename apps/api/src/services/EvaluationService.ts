import { Repository } from "typeorm";
import Redis from "ioredis";
import { Environment } from "../entities/Environment";
import { FlagEnvironmentConfig } from "../entities/FlagEnvironmentConfig";
import { EvaluationEvent } from "../entities/EvaluationEvent";
import { EvaluationEngine, FlagEvaluationOutput } from "../evaluation/EvaluationEngine";

export class EvaluationService {
    private readonly engine: EvaluationEngine;

    constructor(
        private readonly environmentRepo: Repository<Environment>,
        private readonly configRepo: Repository<FlagEnvironmentConfig>,
        private readonly eventRepo: Repository<EvaluationEvent>,
        private readonly redis: Redis
    ) {
        this.engine = new EvaluationEngine(configRepo);
    }

    /**
     * Main data-plane entry point — resolves the environment by API key, loads its flag configs
     * (from Redis cache if available), evaluates all flags, and fires-and-forgets analytics events.
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

        const ctx = context ?? {};
        const { flags } = await this.engine.evaluate(configs, ctx);

        // Log evaluation events asynchronously — failures here must not affect the response.
        this.logEvents(environment.id, flags, ctx).catch(() => { });
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

    /**
     * Batch-inserts one event per evaluated flag for analytics.
     * M5: Strip PII fields (userId, email, name, phone, ip) before storing context.
     * Only non-identifying attributes are kept for segmentation queries.
     */
    private async logEvents(environmentId: string, flags: Record<string, FlagEvaluationOutput>, context: Record<string, unknown>): Promise<void> {
        const safeContext = this.stripPii(context);
        const events = Object.entries(flags).map(([flagKey, result]) => ({
            environmentId, flagKey, result: Boolean(result.value),
            context: Object.keys(safeContext).length > 0 ? safeContext : undefined,
        }));
        if (events.length > 0) await this.eventRepo.insert(events as any);
    }

    private static readonly PII_KEYS = new Set(["userId", "user_id", "email", "name", "phone", "ip", "ipAddress", "address", "ssn", "dob", "dateOfBirth", "identifier"]);

    /** Returns a shallow copy of context with known PII keys removed. */
    private stripPii(context: Record<string, unknown>): Record<string, unknown> {
        return Object.fromEntries(
            Object.entries(context).filter(([k]) => !EvaluationService.PII_KEYS.has(k))
        );
    }
}
