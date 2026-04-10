// Unit tests: EvalThrottle middleware (U-ET-01..07)
import { describe, it, expect, vi, beforeEach } from "vitest";
import { makeEvalThrottle } from "../../src/middleware/evalThrottle";

const makeRedis = () => ({
    get: vi.fn(),
    set: vi.fn().mockResolvedValue("OK"),
});

function makeReqReply(apiKey: string | null = "vex_testkey") {
    const reply = {
        code: vi.fn().mockReturnThis(),
        send: vi.fn().mockReturnThis(),
        header: vi.fn().mockReturnThis(),
    };
    const req = {
        headers: {
            authorization: apiKey ? `Bearer ${apiKey}` : undefined,
        },
    };
    return { req, reply };
}

// Reset env to known defaults
beforeEach(() => {
    vi.resetAllMocks();
    process.env.EVAL_BUCKET_CAPACITY = "5";
    process.env.EVAL_REFILL_RATE_MS = "2000";
});

describe("EvalThrottle middleware", () => {
    it("U-ET-01: first request — bucket initialized, redis.set called", async () => {
        const redis = makeRedis();
        redis.get.mockResolvedValue(null); // no existing bucket
        const throttle = makeEvalThrottle(redis as any);
        const { req, reply } = makeReqReply();

        await throttle(req as any, reply as any);

        expect(redis.set).toHaveBeenCalledTimes(1);
        const stored = JSON.parse(redis.set.mock.calls[0][1]);
        expect(stored.tokens).toBe(4); // CAPACITY(5) - 1
    });

    it("U-ET-02: request within bucket → allowed through (no 429)", async () => {
        const redis = makeRedis();
        // Bucket has 3 tokens remaining, last refill was 1s ago (no new tokens yet)
        redis.get.mockResolvedValue(JSON.stringify({ tokens: 3, lastRefill: Date.now() - 100 }));
        const throttle = makeEvalThrottle(redis as any);
        const { req, reply } = makeReqReply();

        await throttle(req as any, reply as any);

        expect(reply.code).not.toHaveBeenCalledWith(429);
    });

    it("U-ET-03: bucket exhausted (tokens become < 0) → 429 with Retry-After header", async () => {
        const redis = makeRedis();
        // Only 0 tokens left — next decrement makes it -1
        redis.get.mockResolvedValue(JSON.stringify({ tokens: 0, lastRefill: Date.now() - 100 }));
        const throttle = makeEvalThrottle(redis as any);
        const { req, reply } = makeReqReply();

        await throttle(req as any, reply as any);

        expect(reply.code).toHaveBeenCalledWith(429);
        expect(reply.header).toHaveBeenCalledWith("Retry-After", expect.any(String));
    });

    it("U-ET-04: elapsed time → tokens refilled correctly", async () => {
        const redis = makeRedis();
        // 0 tokens, but 4000ms elapsed → should refill 2 tokens (floor(4000/2000))
        redis.get.mockResolvedValue(JSON.stringify({ tokens: 0, lastRefill: Date.now() - 4000 }));
        const throttle = makeEvalThrottle(redis as any);
        const { req, reply } = makeReqReply();

        await throttle(req as any, reply as any);

        expect(reply.code).not.toHaveBeenCalledWith(429); // 0 + 2 refilled - 1 = 1 remaining → ok
    });

    it("U-ET-05: no Authorization header → passes through (no Redis call)", async () => {
        const redis = makeRedis();
        const throttle = makeEvalThrottle(redis as any);
        const { req, reply } = makeReqReply(null); // no auth header

        await throttle(req as any, reply as any);

        expect(redis.get).not.toHaveBeenCalled();
        expect(reply.code).not.toHaveBeenCalledWith(429);
    });

    it("U-ET-06: redis.get throws → fail-open (no 429)", async () => {
        const redis = makeRedis();
        redis.get.mockRejectedValue(new Error("Redis connection failed"));
        const throttle = makeEvalThrottle(redis as any);
        const { req, reply } = makeReqReply();

        await throttle(req as any, reply as any);

        expect(reply.code).not.toHaveBeenCalledWith(429);
    });

    it("U-ET-07: redis.set throws → fail-open (no crash)", async () => {
        const redis = makeRedis();
        redis.get.mockResolvedValue(null);
        redis.set.mockRejectedValue(new Error("Redis write failed"));
        const throttle = makeEvalThrottle(redis as any);
        const { req, reply } = makeReqReply();

        // Should not throw
        await expect(throttle(req as any, reply as any)).resolves.toBeUndefined();
    });
});
