import "reflect-metadata";
// Unit tests: EnvironmentService
import { describe, it, expect, vi, beforeEach } from "vitest";
import { EnvironmentService } from "../../src/services/EnvironmentService";

const makeEnvRepo = () => ({
    create: vi.fn((data: any) => data),
    save: vi.fn(),
    find: vi.fn(),
    findOne: vi.fn(),
    delete: vi.fn(),
});
const makeRedis = () => ({
    del: vi.fn().mockResolvedValue(1),
});

describe("EnvironmentService", () => {
    let envRepo: ReturnType<typeof makeEnvRepo>;
    let redis: ReturnType<typeof makeRedis>;
    let svc: EnvironmentService;

    beforeEach(() => {
        vi.resetAllMocks();
        envRepo = makeEnvRepo();
        redis = makeRedis();
        svc = new EnvironmentService(envRepo as any, redis as any);
    });

    // --- createEnvironment ---

    it("U-ENV-01: createEnvironment — valid name → saves and returns env with vex_ apiKey", async () => {
        const project = { id: "p-1" } as any;
        envRepo.save.mockResolvedValue({ id: "e-1", name: "production", apiKey: "vex_abc123" });

        const result = await svc.createEnvironment(project, "production");

        expect(envRepo.create).toHaveBeenCalledWith(expect.objectContaining({ name: "production" }));
        // apiKey should start with vex_
        const createCall = envRepo.create.mock.calls[0][0];
        expect(createCall.apiKey).toMatch(/^vex_/);
        expect(envRepo.save).toHaveBeenCalledTimes(1);
    });

    it("U-ENV-02: createEnvironment — name too short (1 char) → throws", async () => {
        await expect(svc.createEnvironment({ id: "p-1" } as any, "x"))
            .rejects.toThrow("at least 2 characters");
    });

    it("U-ENV-03: createEnvironment — empty name → throws", async () => {
        await expect(svc.createEnvironment({ id: "p-1" } as any, ""))
            .rejects.toThrow();
    });

    it("U-ENV-04: createEnvironment — trims whitespace from name", async () => {
        envRepo.save.mockResolvedValue({ id: "e-1", name: "staging", apiKey: "vex_x" });
        await svc.createEnvironment({ id: "p-1" } as any, "  staging  ");
        expect(envRepo.create).toHaveBeenCalledWith(expect.objectContaining({ name: "staging" }));
    });

    // --- listEnvironments ---

    it("U-ENV-05: listEnvironments — returns array from repo", async () => {
        envRepo.find.mockResolvedValue([{ id: "e-1" }, { id: "e-2" }]);
        const result = await svc.listEnvironments("p-1");
        expect(result).toHaveLength(2);
        expect(envRepo.find).toHaveBeenCalledWith({ where: { project: { id: "p-1" } } });
    });

    // --- getEnvironment ---

    it("U-ENV-06: getEnvironment — existing id → returns env with project relation", async () => {
        envRepo.findOne.mockResolvedValue({ id: "e-1", project: { id: "p-1" } });
        const result = await svc.getEnvironment("e-1");
        expect(result ?.id).toBe("e-1");
        expect(envRepo.findOne).toHaveBeenCalledWith({ where: { id: "e-1" }, relations: ["project"] });
    });

    it("U-ENV-07: getEnvironment — not found → returns null", async () => {
        envRepo.findOne.mockResolvedValue(null);
        const result = await svc.getEnvironment("missing");
        expect(result).toBeNull();
    });

    // --- deleteEnvironment ---

    it("U-ENV-08: deleteEnvironment — existing env → deletes and busts Redis cache keys", async () => {
        envRepo.findOne.mockResolvedValue({ id: "e-1", apiKey: "vex_oldkey", project: { id: "p-1" } });
        envRepo.delete.mockResolvedValue({ affected: 1 });

        const result = await svc.deleteEnvironment("e-1");

        expect(result).toBe(true);
        expect(redis.del).toHaveBeenCalledWith("env_apikey:vex_oldkey");
        expect(redis.del).toHaveBeenCalledWith("env_configs:e-1");
    });

    it("U-ENV-09: deleteEnvironment — not found → returns false without Redis del", async () => {
        envRepo.findOne.mockResolvedValue(null);

        const result = await svc.deleteEnvironment("missing");

        expect(result).toBe(false);
        expect(redis.del).not.toHaveBeenCalled();
    });

    it("U-ENV-10: deleteEnvironment — delete affects 0 rows → returns false", async () => {
        envRepo.findOne.mockResolvedValue({ id: "e-1", apiKey: "vex_k", project: {} });
        envRepo.delete.mockResolvedValue({ affected: 0 });

        const result = await svc.deleteEnvironment("e-1");

        expect(result).toBe(false);
    });

    // --- rotateApiKey ---

    it("U-ENV-11: rotateApiKey — existing env → saves new vex_ key, busts old apiKey cache", async () => {
        const oldEnv = { id: "e-1", apiKey: "vex_oldkey", project: { id: "p-1" } };
        envRepo.findOne.mockResolvedValue({ ...oldEnv });
        envRepo.save.mockImplementation(async (e: any) => e);

        const result = await svc.rotateApiKey("e-1");

        expect(result.apiKey).toMatch(/^vex_/);
        expect(result.apiKey).not.toBe("vex_oldkey");
        expect(redis.del).toHaveBeenCalledWith("env_apikey:vex_oldkey");
        expect(redis.del).toHaveBeenCalledWith("env_configs:e-1");
    });

    it("U-ENV-12: rotateApiKey — not found → throws 'Environment not found'", async () => {
        envRepo.findOne.mockResolvedValue(null);
        await expect(svc.rotateApiKey("missing")).rejects.toThrow("Environment not found");
    });
});
w