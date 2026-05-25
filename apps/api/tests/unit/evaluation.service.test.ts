import "reflect-metadata";
// Unit tests: EvaluationService
import { describe, it, expect, vi, beforeEach } from "vitest";
import { EvaluationService } from "../../src/services/EvaluationService";

const makeEnvironmentRepo = () => ({
    findOne: vi.fn(),
});
const makeConfigRepo = () => ({
    find: vi.fn(),
});
const makeRedis = () => ({
    get: vi.fn(),
    set: vi.fn().mockResolvedValue("OK"),
});

describe("EvaluationService", () => {
    let environmentRepo: ReturnType<typeof makeEnvironmentRepo>;
    let configRepo: ReturnType<typeof makeConfigRepo>;
    let redis: ReturnType<typeof makeRedis>;
    let svc: EvaluationService;

    beforeEach(() => {
        vi.resetAllMocks();
        environmentRepo = makeEnvironmentRepo();
        configRepo = makeConfigRepo();
        redis = makeRedis();
        // Default: no cached data in Redis
        redis.get.mockResolvedValue(null);
        svc = new EvaluationService(
            environmentRepo as any,
            configRepo as any,
            redis as any,
        );
    });

    it("U-ES-01: evaluateFlags — invalid API key → throws 'Invalid API Key'", async () => {
        environmentRepo.findOne.mockResolvedValue(null);
        redis.get.mockResolvedValue(null); // no env cache

        await expect(svc.evaluateFlags("bad-key")).rejects.toThrow("Invalid API Key");
    });

    it("U-ES-02: evaluateFlags — valid API key, no configs → returns empty flags object", async () => {
        const env = { id: "env-1", apiKey: "vex_abc", project: { id: "p-1" } };
        environmentRepo.findOne.mockResolvedValue(env);
        configRepo.find.mockResolvedValue([]); // no flag configs

        const result = await svc.evaluateFlags("vex_abc", { userId: "u-1" });

        expect(result).toEqual({});
    });

    it("U-ES-03: evaluateFlags — configs from DB cached into Redis for 30s", async () => {
        const env = { id: "env-1", apiKey: "vex_abc", project: { id: "p-1" } };
        environmentRepo.findOne.mockResolvedValue(env);
        redis.get.mockResolvedValueOnce(null).mockResolvedValueOnce(null); // first call: no env cache, no config cache
        configRepo.find.mockResolvedValue([]);

        await svc.evaluateFlags("vex_abc");

        expect(redis.set).toHaveBeenCalledWith(
            "env_configs:env-1",
            expect.any(String),
            "EX",
            30,
        );
    });

    it("U-ES-04: evaluateFlags — config cache hit → skips DB configRepo.find", async () => {
        // First call: cache the env but not configs
        const env = { id: "env-1", apiKey: "vex_abc", project: { id: "p-1" } };
        environmentRepo.findOne.mockResolvedValue(env);
        // Redis returns null for env_apikey, then returns cached configs on second get
        redis.get
            .mockResolvedValueOnce(null)          // env_apikey: miss
            .mockResolvedValueOnce(JSON.stringify([])); // env_configs: hit

        await svc.evaluateFlags("vex_abc");

        // configRepo.find should NOT have been called because configs came from cache
        expect(configRepo.find).not.toHaveBeenCalled();
    });

    it("U-ES-05: evaluateFlags — env resolved from apiKey cache → skips environmentRepo.findOne", async () => {
        const env = { id: "env-1", apiKey: "vex_abc", project: { id: "p-1" } };
        // Both env and configs in cache
        redis.get
            .mockResolvedValueOnce(JSON.stringify(env)) // env_apikey: hit
            .mockResolvedValueOnce(JSON.stringify([]));  // env_configs: hit

        await svc.evaluateFlags("vex_abc");

        expect(environmentRepo.findOne).not.toHaveBeenCalled();
    });

    it("U-ES-06: evaluateFlags — boolean flag config → returns flag result", async () => {
        const env = { id: "env-1", apiKey: "vex_abc", project: { id: "p-1" } };
        environmentRepo.findOne.mockResolvedValue(env);
        redis.get.mockResolvedValue(null);
        const configs = [
            {
                flag: { key: "my-flag" },
                environment: { id: "env-1" },
                isEnabled: true,
                strategyType: "boolean",
                strategyConfig: { strategyType: "boolean" },
                scheduledAt: null,
                scheduledConfig: null,
            },
        ];
        configRepo.find.mockResolvedValue(configs);

        const result = await svc.evaluateFlags("vex_abc", {});

        expect(result["my-flag"]).toBeDefined();
        expect(result["my-flag"].value).toBe(true);
    });
});
