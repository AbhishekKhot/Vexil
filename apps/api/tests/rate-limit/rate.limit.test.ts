import "reflect-metadata";
// Rate-limit tests (RL-01..12)
// Uses Fastify inject() with an in-memory rate-limit store (no real Redis needed).
import { describe, it, expect, vi, afterEach } from "vitest";
import Fastify, { FastifyInstance } from "fastify";
import rateLimit from "@fastify/rate-limit";
import * as jwt from "jsonwebtoken";
import { TEST_JWT_SECRET, signToken } from "../helpers/buildTestApp";

// Build a token-bucket throttle with explicit capacity (does not read env vars)
function makeBucketThrottle(capacity: number, refillRateMs: number) {
    const buckets = new Map<string, { tokens: number; lastRefill: number }>();

    return async function throttle(request: any, reply: any): Promise<void> {
        const auth = request.headers.authorization as string | undefined;
        if (!auth ?.startsWith("Bearer ")) return;
        const apiKey = auth.slice(7).trim();
        const now = Date.now();
        const bucket = buckets.get(apiKey);

        let tokens: number;
        let lastRefill: number;

        if (!bucket) {
            tokens = capacity - 1;
            lastRefill = now;
        } else {
            const elapsed = now - bucket.lastRefill;
            const refilled = Math.floor(elapsed / refillRateMs);
            tokens = Math.min(capacity, bucket.tokens + refilled) - 1;
            lastRefill = refilled > 0 ? now : bucket.lastRefill;
        }

        buckets.set(apiKey, { tokens, lastRefill });

        if (tokens < 0) {
            const retryAfterMs = refillRateMs + (tokens + 1) * refillRateMs;
            reply.header("Retry-After", String(Math.ceil(retryAfterMs / 1000)));
            reply.code(429).send({
                error: "Evaluation rate limit exceeded. Slow down SDK polling.",
                retryAfterSeconds: Math.ceil(retryAfterMs / 1000),
            });
        }
    };
}

async function buildApp(options: {
    registerLimit?: number;
    loginLimit?: number;
    evalLimit?: number;
    eventsLimit?: number;
    controlWriteLimit?: number;
    controlReadLimit?: number;
    evalBucketCapacity?: number;
    evalRefillRateMs?: number;
}) {
    process.env.JWT_SECRET = TEST_JWT_SECRET;

    const bucketCapacity = options.evalBucketCapacity ?? 5;
    const bucketRefillMs = options.evalRefillRateMs ?? 60_000;

    const app = Fastify({ logger: false });

    await app.register(rateLimit, {
        global: false,
        keyGenerator: (req) => {
            const auth = req.headers.authorization;
            if (auth ?.startsWith("Bearer vex_")) return `rl:${auth.slice(7, 23)}`;
            return `rl:${req.ip ?? "127.0.0.1"}`;
        },
        errorResponseBuilder: () => ({
            error: "Rate limit exceeded. Too many requests — please slow down.",
            statusCode: 429,
        }),
    });

    app.decorate("authenticate", async (req: any, reply: any) => {
        const auth = req.headers.authorization;
        if (!auth ?.startsWith("Bearer ")) return reply.code(401).send({ error: "Unauthorized" });
        try {
            const payload = jwt.verify(auth.slice(7), TEST_JWT_SECRET) as any;
            req.user = { id: payload.userId, email: payload.email, organizationId: payload.organizationId, role: "ADMIN" };
        } catch { return reply.code(401).send({ error: "Unauthorized" }); }
    });

    const throttle = makeBucketThrottle(bucketCapacity, bucketRefillMs);

    // Auth routes
    app.post("/api/auth/register", { config: { rateLimit: { max: options.registerLimit ?? 5, timeWindow: "1d" } } }, async (_req, reply) => reply.code(201).send({ token: "t" }));
    app.post("/api/auth/login", { config: { rateLimit: { max: options.loginLimit ?? 10, timeWindow: "15m" } } }, async (_req, reply) => reply.code(200).send({ token: "t" }));

    // Data plane
    app.post("/v1/flags/evaluate", { config: { rateLimit: { max: options.evalLimit ?? 100, timeWindow: "1d" } }, preHandler: [throttle] }, async (_req, reply) => reply.code(200).send({ flags: {} }));
    app.post("/v1/events", { config: { rateLimit: { max: options.eventsLimit ?? 50, timeWindow: "1d" } } }, async (_req, reply) => reply.code(202).send({ status: "accepted" }));

    // Control plane
    app.post("/api/projects", { config: { rateLimit: { max: options.controlWriteLimit ?? 50, timeWindow: "1d" } }, preHandler: [(app as any).authenticate] }, async (_req, reply) => reply.code(201).send({ id: "p-1" }));
    app.get("/api/projects", { config: { rateLimit: { max: options.controlReadLimit ?? 200, timeWindow: "1d" } }, preHandler: [(app as any).authenticate] }, async (_req, reply) => reply.code(200).send([]));

    await app.ready();
    return app;
}

async function hitN(app: FastifyInstance, n: number, opts: { method: string; url: string; headers?: Record<string, string>; payload?: any }) {
    const results: number[] = [];
    for (let i = 0; i < n; i++) {
        const res = await app.inject({ method: opts.method as any, url: opts.url, headers: opts.headers, payload: opts.payload });
        results.push(res.statusCode);
    }
    return results;
}

describe("Rate Limit Tests", () => {
    let app: FastifyInstance | undefined;

    afterEach(async () => {
        if (app) { await app.close(); app = undefined; }
    });

    it("RL-01: POST /register — 6th request → 429 (limit=5)", async () => {
        app = await buildApp({ registerLimit: 5 });
        const results = await hitN(app, 6, { method: "POST", url: "/api/auth/register", payload: { email: "a@b.com", password: "pass", name: "A", orgName: "O" } });
        expect(results.slice(0, 5).every(s => s === 201)).toBe(true);
        expect(results[5]).toBe(429);
    });

    it("RL-02: POST /login — 11th request → 429 (limit=10)", async () => {
        app = await buildApp({ loginLimit: 10 });
        const results = await hitN(app, 11, { method: "POST", url: "/api/auth/login", payload: { email: "a@b.com", password: "pass" } });
        expect(results.slice(0, 10).every(s => s === 200)).toBe(true);
        expect(results[10]).toBe(429);
    });

    it("RL-03: POST /login — exactly 10 requests → all succeed (limit boundary)", async () => {
        app = await buildApp({ loginLimit: 10 });
        const results = await hitN(app, 10, { method: "POST", url: "/api/auth/login", payload: { email: "a@b.com", password: "pass" } });
        expect(results.every(s => s === 200)).toBe(true);
    });

    it("RL-04: POST /v1/flags/evaluate — 101st request → 429 (eval limit=100, large bucket so bucket doesn't throttle first)", async () => {
        // Use very large bucket capacity so the @fastify/rate-limit (100/day) fires first
        app = await buildApp({ evalLimit: 100, evalBucketCapacity: 10000, evalRefillRateMs: 1 });
        const results = await hitN(app, 101, { method: "POST", url: "/v1/flags/evaluate", headers: { authorization: "Bearer vex_ratelimitk001" }, payload: {} });
        expect(results.slice(0, 100).every(s => s === 200)).toBe(true);
        expect(results[100]).toBe(429);
    });

    it("RL-05: POST /v1/events — 51st request → 429 (limit=50)", async () => {
        app = await buildApp({ eventsLimit: 50 });
        const results = await hitN(app, 51, { method: "POST", url: "/v1/events", headers: { authorization: "Bearer vex_eventskey01" }, payload: [{ flagKey: "f", result: true }] });
        expect(results.slice(0, 50).every(s => s === 202)).toBe(true);
        expect(results[50]).toBe(429);
    });

    it("RL-06: Control plane write — 51st request → 429 (limit=50)", async () => {
        app = await buildApp({ controlWriteLimit: 50 });
        const token = signToken();
        const results = await hitN(app, 51, { method: "POST", url: "/api/projects", headers: { authorization: `Bearer ${token}` }, payload: { name: "P" } });
        expect(results.slice(0, 50).every(s => s === 201)).toBe(true);
        expect(results[50]).toBe(429);
    });

    it("RL-07: Control plane read — 201st request → 429 (limit=200)", async () => {
        app = await buildApp({ controlReadLimit: 200 });
        const token = signToken();
        const results = await hitN(app, 201, { method: "GET", url: "/api/projects", headers: { authorization: `Bearer ${token}` } });
        expect(results.slice(0, 200).every(s => s === 200)).toBe(true);
        expect(results[200]).toBe(429);
    });

    it("RL-08: Token bucket — 6th eval burst request → 429 with Retry-After header (capacity=5)", async () => {
        app = await buildApp({ evalBucketCapacity: 5, evalRefillRateMs: 60_000, evalLimit: 10000 });
        const responses: Array<{ status: number; headers: Record<string, any> }> = [];
        for (let i = 0; i < 6; i++) {
            const res = await app.inject({ method: "POST", url: "/v1/flags/evaluate", headers: { authorization: "Bearer vex_bucketkey000" }, payload: {} });
            responses.push({ status: res.statusCode, headers: res.headers as any });
        }
        expect(responses.slice(0, 5).every(r => r.status === 200)).toBe(true);
        expect(responses[5].status).toBe(429);
        expect(responses[5].headers["retry-after"]).toBeDefined();
    });

    it("RL-09: Token bucket — different API keys are independent (A throttled, B not)", async () => {
        app = await buildApp({ evalBucketCapacity: 1, evalRefillRateMs: 60_000, evalLimit: 10000 });

        // Exhaust key A (2 requests with capacity=1, so 2nd is throttled)
        await app.inject({ method: "POST", url: "/v1/flags/evaluate", headers: { authorization: "Bearer vex_keyAAAAAAA00" }, payload: {} });
        const throttledA = await app.inject({ method: "POST", url: "/v1/flags/evaluate", headers: { authorization: "Bearer vex_keyAAAAAAA00" }, payload: {} });

        // Key B should still be fresh
        const okB = await app.inject({ method: "POST", url: "/v1/flags/evaluate", headers: { authorization: "Bearer vex_keyBBBBBBB00" }, payload: {} });

        expect(throttledA.statusCode).toBe(429);
        expect(okB.statusCode).toBe(200);
    });

    it("RL-10: Token bucket — after refill window passes → request succeeds", { timeout: 15000 }, async () => {
        // Build a standalone bucket directly (no Fastify overhead, just the bucket logic)
        // This verifies the token refill math without needing to spin up a full app
        const capacity = 1;
        const refillRateMs = 1000;
        const buckets = new Map<string, { tokens: number; lastRefill: number }>();

        function simulateRequest(key: string, nowMs: number): 200 | 429 {
            const bucket = buckets.get(key);
            let tokens: number;
            let lastRefill: number;
            if (!bucket) {
                tokens = capacity - 1;
                lastRefill = nowMs;
            } else {
                const elapsed = nowMs - bucket.lastRefill;
                const refilled = Math.floor(elapsed / refillRateMs);
                tokens = Math.min(capacity, bucket.tokens + refilled) - 1;
                lastRefill = refilled > 0 ? nowMs : bucket.lastRefill;
            }
            buckets.set(key, { tokens, lastRefill });
            return tokens < 0 ? 429 : 200;
        }

        const t0 = Date.now();
        expect(simulateRequest("key-x", t0)).toBe(200);        // 1st: ok
        expect(simulateRequest("key-x", t0 + 10)).toBe(429);   // 2nd: exhausted
        // After 2s (> 1 refill period), tokens refill
        expect(simulateRequest("key-x", t0 + 2100)).toBe(200); // 3rd: refilled
    });

    it("RL-11: 429 response includes error field with human-readable message", async () => {
        app = await buildApp({ registerLimit: 1 });
        await app.inject({ method: "POST", url: "/api/auth/register", payload: { email: "a@b.com", password: "pass", name: "A", orgName: "O" } });
        const res = await app.inject({ method: "POST", url: "/api/auth/register", payload: { email: "a@b.com", password: "pass", name: "A", orgName: "O" } });
        expect(res.statusCode).toBe(429);
        const body = res.json();
        expect(body.error).toBeDefined();
        expect(typeof body.error).toBe("string");
    });

    it("RL-12: Rate limit headers present in response (X-RateLimit-Limit, X-RateLimit-Remaining)", async () => {
        app = await buildApp({ loginLimit: 10 });
        const res = await app.inject({ method: "POST", url: "/api/auth/login", payload: { email: "a@b.com", password: "pass" } });
        expect(res.headers["x-ratelimit-limit"]).toBeDefined();
        expect(res.headers["x-ratelimit-remaining"]).toBeDefined();
    });
});
