// Unit tests: FlagConfigService (U-FC-01..08)
import { describe, it, expect, vi, beforeEach } from "vitest";
import { FlagConfigService } from "../../src/services/FlagConfigService";

const makeConfigRepo = () => ({
    findOne: vi.fn(),
    create: vi.fn(),
    save: vi.fn(),
});

const makeRedis = () => ({
    del: vi.fn().mockResolvedValue(1),
});

const mockFlag = { id: "flag-1", key: "my-flag" } as any;
const mockEnv  = { id: "env-1", name: "production" } as any;

describe("FlagConfigService", () => {
    let configRepo: ReturnType<typeof makeConfigRepo>;
    let redis: ReturnType<typeof makeRedis>;
    let svc: FlagConfigService;

    beforeEach(() => {
        vi.resetAllMocks();
        configRepo = makeConfigRepo();
        redis = makeRedis();
        svc = new FlagConfigService(configRepo as any, redis as any);
    });

    it("U-FC-01: getFlagConfig → delegates to repo with correct flagId + environmentId", async () => {
        configRepo.findOne.mockResolvedValue({ id: "cfg-1" });
        const result = await svc.getFlagConfig("flag-1", "env-1");
        expect(configRepo.findOne).toHaveBeenCalledTimes(1);
        expect(configRepo.findOne).toHaveBeenCalledWith(
            expect.objectContaining({ where: { flag: { id: "flag-1" }, environment: { id: "env-1" } } })
        );
        expect(result).toEqual({ id: "cfg-1" });
    });

    it("U-FC-02: setFlagConfig — no existing config → calls create + save", async () => {
        configRepo.findOne.mockResolvedValue(null); // no existing
        const newCfg = { id: "cfg-new", isEnabled: true, strategyType: "boolean" };
        configRepo.create.mockReturnValue(newCfg);
        configRepo.save.mockResolvedValue(newCfg);

        await svc.setFlagConfig({ flag: mockFlag, environment: mockEnv, isEnabled: true, strategyType: "boolean" });

        expect(configRepo.create).toHaveBeenCalledTimes(1);
        expect(configRepo.save).toHaveBeenCalledTimes(1);
    });

    it("U-FC-03: setFlagConfig — existing config → updates in place, no create called", async () => {
        const existing = { id: "cfg-1", isEnabled: false, strategyType: "boolean", strategyConfig: undefined };
        configRepo.findOne.mockResolvedValue(existing);
        configRepo.save.mockResolvedValue({ ...existing, isEnabled: true });

        await svc.setFlagConfig({ flag: mockFlag, environment: mockEnv, isEnabled: true });

        expect(configRepo.create).not.toHaveBeenCalled();
        expect(configRepo.save).toHaveBeenCalledTimes(1);
    });

    it("U-FC-04: setFlagConfig — invalid strategyType → StrategyValidationError, redis NOT called", async () => {
        configRepo.findOne.mockResolvedValue(null);

        // StrategyFactory.parse() throws when required field is missing entirely
        // rollout requires 'percentage' to be a number — passing non-number triggers the error
        await expect(
            svc.setFlagConfig({
                flag: mockFlag,
                environment: mockEnv,
                isEnabled: true,
                strategyType: "rollout",
                strategyConfig: { percentage: "not-a-number" as any }, // parse() throws: percentage must be a number
            })
        ).rejects.toThrow();

        expect(redis.del).not.toHaveBeenCalled();
    });

    it("U-FC-05: setFlagConfig — valid config → redis.del called with correct key", async () => {
        configRepo.findOne.mockResolvedValue(null);
        const cfg = { id: "cfg-1", isEnabled: true, strategyType: "boolean" };
        configRepo.create.mockReturnValue(cfg);
        configRepo.save.mockResolvedValue(cfg);

        await svc.setFlagConfig({ flag: mockFlag, environment: mockEnv, isEnabled: true, strategyType: "boolean" });

        expect(redis.del).toHaveBeenCalledWith("env_configs:env-1");
    });

    it("U-FC-06: setFlagConfig — redis.del throws → error swallowed, config still returned", async () => {
        configRepo.findOne.mockResolvedValue(null);
        const cfg = { id: "cfg-1", isEnabled: true, strategyType: "boolean" };
        configRepo.create.mockReturnValue(cfg);
        configRepo.save.mockResolvedValue(cfg);
        redis.del.mockRejectedValue(new Error("Redis down"));

        await expect(
            svc.setFlagConfig({ flag: mockFlag, environment: mockEnv, isEnabled: true, strategyType: "boolean" })
        ).resolves.toBeDefined(); // should not throw
    });

    it("U-FC-07: setFlagConfig — strategyType stripped from strategyConfig JSONB column", async () => {
        const existing = { id: "cfg-1", isEnabled: true, strategyType: "rollout", strategyConfig: {} };
        configRepo.findOne.mockResolvedValue(existing);
        configRepo.save.mockImplementation(async (cfg: any) => cfg);

        await svc.setFlagConfig({
            flag: mockFlag,
            environment: mockEnv,
            isEnabled: true,
            strategyType: "rollout",
            strategyConfig: { strategyType: "rollout", percentage: 50, hashAttribute: "userId" },
        });

        const savedArg = configRepo.save.mock.calls[0][0];
        // strategyType should NOT be in strategyConfig JSONB
        expect(savedArg.strategyConfig).not.toHaveProperty("strategyType");
        expect(savedArg.strategyConfig).toHaveProperty("percentage", 50);
    });

    it("U-FC-08: setFlagConfig — scheduledAt set → saved as Date object", async () => {
        configRepo.findOne.mockResolvedValue(null);
        configRepo.create.mockImplementation((data: any) => data);
        configRepo.save.mockImplementation(async (cfg: any) => cfg);

        const scheduledAt = "2025-12-01T00:00:00Z";
        await svc.setFlagConfig({
            flag: mockFlag,
            environment: mockEnv,
            isEnabled: true,
            scheduledAt,
        });

        const created = configRepo.create.mock.calls[0][0];
        expect(created.scheduledAt).toBeInstanceOf(Date);
    });
});
