import "reflect-metadata";

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

        redis.get.mockResolvedValue(null);
        svc = new EvaluationService(
            environmentRepo as any,
            configRepo as any,
            redis as any,
        );
    });

    it("U-ES-01: evaluateFlags — invalid API key → throws 'Invalid API Key'", async () => {
        environmentRepo.findOne.mockResolvedValue(null);
        redis.get.mockResolvedValue(null);

        await expect(svc.evaluateFlags("bad-key")).rejects.toThrow("Invalid API Key");
    });

    it("U-ES-02: evaluateFlags — valid API key, no configs → returns empty flags object", async () => {
        const env = { id: "env-1", apiKey: "vex_abc", project: { id: "p-1" } };
        environmentRepo.findOne.mockResolvedValue(env);
        configRepo.find.mockResolvedValue([]);

        const result = await svc.evaluateFlags("vex_abc", { userId: "u-1" });

        expect(result).toEqual({});
    });

    it("U-ES-03: evaluateFlags — configs from DB cached into Redis for 30s", async () => {
        const env = { id: "env-1", apiKey: "vex_abc", project: { id: "p-1" } };
        environmentRepo.findOne.mockResolvedValue(env);
        redis.get.mockResolvedValueOnce(null).mockResolvedValueOnce(null);
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

        const env = { id: "env-1", apiKey: "vex_abc", project: { id: "p-1" } };
        environmentRepo.findOne.mockResolvedValue(env);

        redis.get
            .mockResolvedValueOnce(null)
            .mockResolvedValueOnce(JSON.stringify([]));

        await svc.evaluateFlags("vex_abc");

        expect(configRepo.find).not.toHaveBeenCalled();
    });

    it("U-ES-05: evaluateFlags — env resolved from apiKey cache → skips environmentRepo.findOne", async () => {
        const env = { id: "env-1", apiKey: "vex_abc", project: { id: "p-1" } };

        redis.get
            .mockResolvedValueOnce(JSON.stringify(env))
            .mockResolvedValueOnce(JSON.stringify([]));

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
