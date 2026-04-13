// Unit tests: SchedulerService (U-SC-01..06)
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

    it("U-SC-01: no overdue configs → repo.save not called", async () => {
        configRepo.find.mockResolvedValue([]);

        // Trigger the immediate check (1s after start)
        svc.start();
        await vi.advanceTimersByTimeAsync(1100);

        expect(configRepo.save).not.toHaveBeenCalled();
    });

    it("U-SC-02: one overdue config with scheduledConfig → updates isEnabled + strategyType", async () => {
        const config = {
            id: "cfg-1",
            isEnabled: false,
            strategyType: "boolean",
            strategyConfig: undefined,
            scheduledAt: new Date(Date.now() - 1000), // past
            scheduledConfig: { isEnabled: true, strategyType: "rollout", strategyConfig: { percentage: 50, hashAttribute: "userId" } },
            environment: { id: "env-1" },
        };
        configRepo.find.mockResolvedValue([config]);
        configRepo.save.mockResolvedValue(config);

        svc.start();
        await vi.advanceTimersByTimeAsync(1100);

        expect(configRepo.save).toHaveBeenCalledTimes(1);
        const saved = configRepo.save.mock.calls[0][0];
        expect(saved.isEnabled).toBe(true);
        expect(saved.strategyType).toBe("rollout");
        expect(saved.scheduledAt).toBeUndefined();
    });

    it("U-SC-03: after applying changes → redis cache busted for that environment", async () => {
        const config = {
            id: "cfg-1",
            isEnabled: false,
            scheduledAt: new Date(Date.now() - 1000),
            scheduledConfig: { isEnabled: true },
            environment: { id: "env-99" },
        };
        configRepo.find.mockResolvedValue([config]);
        configRepo.save.mockResolvedValue(config);

        svc.start();
        await vi.advanceTimersByTimeAsync(1100);

        expect(redis.del).toHaveBeenCalledWith("env_configs:env-99");
    });

    it("U-SC-04: scheduledConfig null → clears scheduledAt without changing config", async () => {
        const config = {
            id: "cfg-1",
            isEnabled: true,
            strategyType: "boolean",
            scheduledAt: new Date(Date.now() - 1000),
            scheduledConfig: null, // no config to apply
            environment: { id: "env-1" },
        };
        configRepo.find.mockResolvedValue([config]);
        configRepo.save.mockResolvedValue(config);

        svc.start();
        await vi.advanceTimersByTimeAsync(1100);

        const saved = configRepo.save.mock.calls[0][0];
        expect(saved.isEnabled).toBe(true); // unchanged
        expect(saved.scheduledAt).toBeUndefined(); // cleared
    });

    it("U-SC-05: start() → sets 60s interval", () => {
        const setIntervalSpy = vi.spyOn(globalThis, "setInterval");

        svc.start();

        expect(setIntervalSpy).toHaveBeenCalledWith(expect.any(Function), 60_000);
    });

    it("U-SC-06: stop() → clears interval, no more ticks", async () => {
        configRepo.find.mockResolvedValue([]);

        svc.start();
        svc.stop();
        await vi.advanceTimersByTimeAsync(120_000); // advance 2 minutes

        // Only the immediate setTimeout (1s) may have fired, not the 60s interval
        // save should not have been called
        expect(configRepo.save).not.toHaveBeenCalled();
    });
});
