import { FastifyRequest, FastifyReply } from "fastify";
import Redis from "ioredis";

/**
 * Token-bucket throttle for the /v1/flags/evaluate endpoint.
 *
 * Configured via env vars — no redeploy needed to tune for demos:
 *   EVAL_BUCKET_CAPACITY  — max burst size (default: 5 tokens)
 *   EVAL_REFILL_RATE_MS   — one token added every N ms (default: 2000 = 0.5 req/s)
 *
 * Each API key gets its own bucket in Redis (TTL = capacity × refill rate × 2).
 * If Redis is unavailable, the request is allowed through (fail-open) to avoid
 * blocking legitimate traffic during infrastructure hiccups.
 */

const CAPACITY = parseInt(process.env.EVAL_BUCKET_CAPACITY || "5", 10);
const REFILL_RATE_MS = parseInt(process.env.EVAL_REFILL_RATE_MS || "2000", 10);
const BUCKET_TTL_S = Math.ceil((CAPACITY * REFILL_RATE_MS * 2) / 1000);

export function makeEvalThrottle(redis: Redis) {
    return async function evalThrottle(request: FastifyRequest, reply: FastifyReply): Promise<void> {
        const auth = request.headers.authorization;
        if (!auth?.startsWith("Bearer ")) return; // auth failure handled downstream

        const apiKey = auth.slice(7).trim();
        const bucketKey = `eval_bucket:${apiKey}`;

        try {
            const now = Date.now();
            const raw = await redis.get(bucketKey);

            let tokens: number;
            let lastRefill: number;

            if (!raw) {
                // First request — start with a full bucket minus this request.
                tokens = CAPACITY - 1;
                lastRefill = now;
            } else {
                const state = JSON.parse(raw) as { tokens: number; lastRefill: number };
                // Refill tokens based on elapsed time since last request.
                const elapsed = now - state.lastRefill;
                const refilled = Math.floor(elapsed / REFILL_RATE_MS);
                tokens = Math.min(CAPACITY, state.tokens + refilled) - 1;
                lastRefill = refilled > 0 ? now : state.lastRefill;
            }

            if (tokens < 0) {
                const retryAfterMs = REFILL_RATE_MS + (tokens + 1) * REFILL_RATE_MS;
                reply.header("Retry-After", String(Math.ceil(retryAfterMs / 1000)));
                reply.code(429).send({
                    error: "Evaluation rate limit exceeded. Slow down SDK polling.",
                    retryAfterSeconds: Math.ceil(retryAfterMs / 1000),
                });
                return;
            }

            await redis.set(bucketKey, JSON.stringify({ tokens, lastRefill }), "EX", BUCKET_TTL_S);
        } catch {
            // Redis unavailable — fail open rather than blocking legitimate traffic.
        }
    };
}
