import "reflect-metadata";
// Unit tests: SchedulerService (SS-1..10)
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { SchedulerService } from "../../src/services/SchedulerService";

const makeConfigRepo = () => ({
    find: vi.fn(),
    save: vi.fn(),
});

const makeRedis = () => ({
    del: vi.fn().mockResolvedValue(1),
});

describe("SchedulerService", () => {
    let configRepo: ReturnType<typeof makeConfigRepo>;
    let redis: ReturnType<typeof makeRedis>;
    let svc: SchedulerService;

    beforeEach(() => {
        vi.resetAllMocks();
        vi.useFakeTimers();
        configRepo = makeConfigRepo();
        redis = makeRedis();
        svc = new SchedulerService(configRepo as any, redis as any);
    });

    afterEach(() => {
        svc.stop();
        vi.useRealTimers();
    });

    // --- start() / stop() ---

    it("SS-1: start() — timer is non-null after first call", () => {
        configRepo.find.mockResolvedValue([]);
        svc.start();
        expect((svc as any).timer).not.toBeNull();
    });

    it("SS-2: start() is idempotent — second call does not replace the timer", () => {
        configRepo.find.mockResolvedValue([]);
        svc.start();
        const firstTimer = (svc as any).timer;
        svc.start();
        expect((svc as any).timer).toBe(firstTimer);
    });

    it("SS-3: stop() — clears timer and sets it to null", () => {
        configRepo.find.mockResolvedValue([]);
        svc.start();
        svc.stop();
        expect((svc as any).timer).toBeNull();
    });

    it("SS-4: stop() on unstarted scheduler — no error, timer stays null", () => {
        expect(() => svc.stop()).not.toThrow();
        expect((svc as any).timer).toBeNull();
    });

    // --- checkScheduledChanges() ---

    it("SS-5: due config with scheduledConfig — applies isEnabled, strategyType, strategyConfig, clears scheduledAt and nullifies scheduledConfig", async () => {
        const config: any = {
            scheduledAt: new Date(Date.now() - 1000),
            scheduledConfig: { isEnabled: true, strategyType: "rollout", strategyConfig: { percentage: 50 } },
            environment: { id: "env-1" },
            isEnabled: false,
            strategyType: "boolean",
            strategyConfig: null,
        };
        configRepo.find.mockResolvedValue([config]);
        configRepo.save.mockResolvedValue(config);

        await (svc as any).checkScheduledChanges();

        expect(config.isEnabled).toBe(true);
        expect(config.strategyType).toBe("rollout");
        expect(config.strategyConfig).toEqual({ percentage: 50 });
        expect(config.scheduledAt).toBeUndefined();
        expect(config.scheduledConfig).toBeNull();
        expect(configRepo.save).toHaveBeenCalledTimes(1);
    });

    it("SS-6: due config without scheduledConfig — only clears scheduledAt, does not touch other fields", async () => {
        const config: any = {
            scheduledAt: new Date(Date.now() - 1000),
            scheduledConfig: null,
            environment: { id: "env-1" },
            isEnabled: false,
            strategyType: "boolean",
        };
        configRepo.find.mockResolvedValue([config]);
        configRepo.save.mockResolvedValue(config);

        await (svc as any).checkScheduledChanges();

        expect(config.isEnabled).toBe(false);      // unchanged
        expect(config.strategyType).toBe("boolean"); // unchanged
        expect(config.scheduledAt).toBeUndefined();
        expect(configRepo.save).toHaveBeenCalledTimes(1);
    });

    it("SS-7: due config with scheduledConfig — busts Redis cache for the environment", async () => {
        const config: any = {
            scheduledAt: new Date(Date.now() - 1000),
            scheduledConfig: { isEnabled: true },
            environment: { id: "env-42" },
            isEnabled: false,
            strategyType: "boolean",
        };
        configRepo.find.mockResolvedValue([config]);
        configRepo.save.mockResolvedValue(config);

        await (svc as any).checkScheduledChanges();

        expect(redis.del).toHaveBeenCalledWith("env_configs:env-42");
    });

    it("SS-8: Redis is undefined — no crash when busting cache after applying scheduled config", async () => {
        const svcNoRedis = new SchedulerService(configRepo as any, undefined);
        const config: any = {
            scheduledAt: new Date(Date.now() - 1000),
            scheduledConfig: { isEnabled: true },
            environment: { id: "env-1" },
            isEnabled: false,
            strategyType: "boolean",
        };
        configRepo.find.mockResolvedValue([config]);
        configRepo.save.mockResolvedValue(config);

        await expect((svcNoRedis as any).checkScheduledChanges()).resolves.toBeUndefined();
    });

    it("SS-9: configRepo.find throws — error caught and logged, does not propagate to caller", async () => {
        const spy = vi.spyOn(console, "error").mockImplementation(() => { });
        configRepo.find.mockRejectedValue(new Error("DB connection lost"));

        await expect((svc as any).checkScheduledChanges()).resolves.toBeUndefined();
        expect(spy).toHaveBeenCalledWith("[SchedulerService]", expect.any(Error));
        spy.mockRestore();
    });

    it("SS-10: zero due configs — no saves, no Redis calls", async () => {
        configRepo.find.mockResolvedValue([]);

        await (svc as any).checkScheduledChanges();

        expect(configRepo.save).not.toHaveBeenCalled();
        expect(redis.del).not.toHaveBeenCalled();
    });
});
