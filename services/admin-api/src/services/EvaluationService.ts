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
        private readonly redisClient: Redis
    ) {
        // Engine is constructed once per service instance — it holds only repo refs
        this.engine = new EvaluationEngine(configRepo);
    }

    async getEnvironmentByApiKey(apiKey: string): Promise<Environment | null> {
        const cacheKey = `env_apikey:${apiKey}`;
        const cached = await this.redisGet(cacheKey);
        
        if (cached) {
            console.log(`[CACHE HIT] Environment loaded via redis: ${cacheKey}`);
            return JSON.parse(cached) as Environment;
        }

        console.log(`[CACHE MISS] Querying postgres for ${cacheKey}`);
        const env = await this.environmentRepo.findOne({
            where: { apiKey },
            relations: ["project"],
        });

        if (env) {
            await this.redisSet(cacheKey, JSON.stringify(env), 300); // 5 minutes TTL
        }

        return env;
    }

    // ─── Redis helpers (graceful degradation) ───────────────────────────────

    private async redisGet(key: string): Promise<string | null> {
        try { return await this.redisClient.get(key); }
        catch { return null; }
    }

    private async redisSet(key: string, value: string, ttl: number): Promise<void> {
        try { await this.redisClient.set(key, value, "EX", ttl); }
        catch { /* Cache unavailable — non-fatal */ }
    }

    async invalidateEnvironmentCache(environmentId: string): Promise<void> {
        try { await this.redisClient.del(`env_configs:${environmentId}`); }
        catch { /* Ignore */ }
    }

    // ─── Main evaluation entry point ─────────────────────────────────────────

    async evaluateFlags(
        apiKey: string,
        context?: Record<string, unknown>
    ): Promise<Record<string, FlagEvaluationOutput>> {
        // 1. Validate API key
        const environment = await this.getEnvironmentByApiKey(apiKey);
        if (!environment) throw new Error("Invalid API Key");

        // 2. Load FlagEnvironmentConfigs — try Redis cache first
        const cacheKey = `env_configs:${environment.id}`;
        let configs: FlagEnvironmentConfig[];

        const cached = await this.redisGet(cacheKey);
        if (cached) {
            console.log(`[CACHE HIT] Configurations loaded via redis: ${cacheKey}`);
            // Cached as raw JSON; re-instantiate relations manually
            configs = JSON.parse(cached) as FlagEnvironmentConfig[];
        } else {
            console.log(`[CACHE MISS] Querying postgres for ${cacheKey}`);
            configs = await this.configRepo.find({
                where: { environment: { id: environment.id } },
                relations: ["flag", "environment"],
            });
            // Cache raw configs for 30s (context-independent; rules run in-memory)
            await this.redisSet(cacheKey, JSON.stringify(configs), 30);
        }

        // 3. Run the evaluation engine
        const ctx = context ?? {};
        const { flags } = await this.engine.evaluate(configs, ctx);

        // 4. Log evaluation events asynchronously — fire-and-forget, never blocks
        this.logEvents(environment.id, flags, ctx).catch(() => {/* silently ignore */});

        return flags;
    }

    // ─── Analytics event logging ─────────────────────────────────────────────

    private async logEvents(
        environmentId: string,
        flags: Record<string, FlagEvaluationOutput>,
        context: Record<string, unknown>
    ): Promise<void> {
        const events = Object.entries(flags).map(([flagKey, result]) => ({
            environmentId,
            flagKey,
            result: Boolean(result.value),
            context: Object.keys(context).length > 0 ? context : undefined,
        }));

        if (events.length > 0) {
            await this.eventRepo.insert(events as any);
        }
    }
}
