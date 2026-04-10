import "reflect-metadata";
// Integration tests: Evaluation route (I-EV-01..10)
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import Fastify, { FastifyInstance } from "fastify";
import { TEST_JWT_SECRET } from "../helpers/buildTestApp";
import { EvaluationController } from "../../src/controllers/EvaluationController";
import { makeEvalThrottle } from "../../src/middleware/evalThrottle";

const mockEvalService = {
    evaluateFlags: vi.fn(),
};

vi.mock("../../src/services/EvaluationService", () => ({
    EvaluationService: vi.fn().mockImplementation(() => mockEvalService),
}));

function makeFakeRedis(tokens = 10) {
    let currentTokens = tokens;
    return {
        get: vi.fn().mockImplementation(async () => {
            if (currentTokens > 0) return null; // triggers fresh bucket
            return JSON.stringify({ tokens: -1, lastRefill: Date.now() });
        }),
        set: vi.fn().mockImplementation(async (_k: any, val: any) => {
            const parsed = JSON.parse(val);
            currentTokens = parsed.tokens;
            return "OK";
        }),
        del: vi.fn().mockResolvedValue(1),
        decrementFn: () => { currentTokens--; },
    };
}

async function buildApp(fakeRedis?: any) {
    process.env.JWT_SECRET = TEST_JWT_SECRET;
    process.env.EVAL_BUCKET_CAPACITY = "5";
    process.env.EVAL_REFILL_RATE_MS = "2000";

    const redis = fakeRedis ?? {
        get: vi.fn().mockResolvedValue(null),
        set: vi.fn().mockResolvedValue("OK"),
        del: vi.fn().mockResolvedValue(1),
    };

    const app = Fastify({ logger: false });
    const ctrl = new EvaluationController(mockEvalService as any);
    const throttle = makeEvalThrottle(redis);

    app.post("/v1/flags/evaluate", { preHandler: [throttle] }, ctrl.eval as any);

    await app.ready();
    return app;
}

describe("Integration: Evaluation Routes", () => {
    let app: FastifyInstance;

    beforeEach(async () => {
        vi.clearAllMocks();
        app = await buildApp();
    });

    afterEach(async () => { await app.close(); });

    it("I-EV-01: valid API key + context → 200, flags object", async () => {
        mockEvalService.evaluateFlags.mockResolvedValue({ "my-flag": { value: true, reason: "ENABLED", type: "release" } });
        const res = await app.inject({
            method: "POST", url: "/v1/flags/evaluate",
            headers: { authorization: "Bearer vex_testapikey" },
            payload: { context: { userId: "alice" } },
        });
        expect(res.statusCode).toBe(200);
        expect(res.json().flags).toBeDefined();
    });

    it("I-EV-02: no Authorization header → 401", async () => {
        const res = await app.inject({ method: "POST", url: "/v1/flags/evaluate", payload: { context: {} } });
        expect(res.statusCode).toBe(401);
    });

    it("I-EV-03: invalid API key → 401", async () => {
        mockEvalService.evaluateFlags.mockRejectedValue(new Error("Invalid API Key"));
        const res = await app.inject({
            method: "POST", url: "/v1/flags/evaluate",
            headers: { authorization: "Bearer bad-key" },
            payload: {},
        });
        expect(res.statusCode).toBe(401);
    });

    it("I-EV-04: empty context → 200, uses default values", async () => {
        mockEvalService.evaluateFlags.mockResolvedValue({});
        const res = await app.inject({
            method: "POST", url: "/v1/flags/evaluate",
            headers: { authorization: "Bearer vex_abc" },
            payload: { context: {} },
        });
        expect(res.statusCode).toBe(200);
    });

    it("I-EV-05: no body → 200 (context optional)", async () => {
        mockEvalService.evaluateFlags.mockResolvedValue({});
        const res = await app.inject({
            method: "POST", url: "/v1/flags/evaluate",
            headers: { authorization: "Bearer vex_abc" },
        });
        expect(res.statusCode).toBe(200);
    });

    it("I-EV-06: EvaluationService throws non-auth error → 500", async () => {
        mockEvalService.evaluateFlags.mockRejectedValue(new Error("DB connection failed"));
        const res = await app.inject({
            method: "POST", url: "/v1/flags/evaluate",
            headers: { authorization: "Bearer vex_abc" },
            payload: {},
        });
        expect(res.statusCode).toBe(500);
    });

    it("I-EV-07: token bucket exhausted → 429 with Retry-After header", async () => {
        // Build app with exhausted bucket
        await app.close();
        const exhaustedRedis = {
            get: vi.fn().mockResolvedValue(JSON.stringify({ tokens: -1, lastRefill: Date.now() })),
            set: vi.fn().mockResolvedValue("OK"),
        };
        app = await buildApp(exhaustedRedis);
        mockEvalService.evaluateFlags.mockResolvedValue({});

        const res = await app.inject({
            method: "POST", url: "/v1/flags/evaluate",
            headers: { authorization: "Bearer vex_somekey" },
            payload: {},
        });
        expect(res.statusCode).toBe(429);
        expect(res.headers["retry-after"]).toBeDefined();
    });

    it("I-EV-09: response shape — flags object has value, reason fields", async () => {
        mockEvalService.evaluateFlags.mockResolvedValue({
            "flag-a": { value: true, reason: "ENABLED", type: "release" },
            "flag-b": { value: false, reason: "ROLLOUT_OUT", type: "release" },
        });
        const res = await app.inject({
            method: "POST", url: "/v1/flags/evaluate",
            headers: { authorization: "Bearer vex_abc" },
            payload: { context: { userId: "alice" } },
        });
        const flags = res.json().flags;
        for (const flag of Object.values(flags) as any[]) {
            expect(flag).toHaveProperty("value");
            expect(flag).toHaveProperty("reason");
        }
    });

    it("I-EV-10: different API keys → independent buckets (both can pass)", async () => {
        await app.close();
        // Fresh redis with no exhaustion
        const freshRedis = {
            get: vi.fn().mockResolvedValue(null),
            set: vi.fn().mockResolvedValue("OK"),
        };
        app = await buildApp(freshRedis);
        mockEvalService.evaluateFlags.mockResolvedValue({});

        const resA = await app.inject({ method: "POST", url: "/v1/flags/evaluate", headers: { authorization: "Bearer vex_keyA" }, payload: {} });
        const resB = await app.inject({ method: "POST", url: "/v1/flags/evaluate", headers: { authorization: "Bearer vex_keyB" }, payload: {} });

        expect(resA.statusCode).toBe(200);
        expect(resB.statusCode).toBe(200);
    });
});
