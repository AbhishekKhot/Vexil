import "reflect-metadata";
// Unit tests: FlagService
import { describe, it, expect, vi, beforeEach } from "vitest";
import { FlagService } from "../../src/services/FlagService";

const makeFlagRepo = () => ({
    create: vi.fn((data: any) => data),
    save: vi.fn(),
    find: vi.fn(),
    findOne: vi.fn(),
    delete: vi.fn(),
});

describe("FlagService", () => {
    let flagRepo: ReturnType<typeof makeFlagRepo>;
    let svc: FlagService;

    beforeEach(() => {
        vi.resetAllMocks();
        flagRepo = makeFlagRepo();
        svc = new FlagService(flagRepo as any);
    });

    // --- createFlag ---

    it("U-FLAG-01: createFlag — valid key/type → saves and returns flag", async () => {
        const project = { id: "p-1" } as any;
        flagRepo.save.mockResolvedValue({ id: "f-1", key: "my-flag", type: "boolean" });

        const result = await svc.createFlag(project, "my-flag");

        expect(flagRepo.create).toHaveBeenCalledWith(expect.objectContaining({ key: "my-flag", type: "boolean" }));
        expect(flagRepo.save).toHaveBeenCalledTimes(1);
    });

    it("U-FLAG-02: createFlag — key too short (2 chars) → throws", async () => {
        await expect(svc.createFlag({} as any, "ab")).rejects.toThrow("at least 3 characters");
    });

    it("U-FLAG-03: createFlag — key with uppercase → throws invalid format", async () => {
        await expect(svc.createFlag({} as any, "My-Flag")).rejects.toThrow("lowercase");
    });

    it("U-FLAG-04: createFlag — key with SQL injection chars → throws", async () => {
        await expect(svc.createFlag({} as any, "flag'; DROP TABLE flags; --")).rejects.toThrow();
    });

    it("U-FLAG-05: createFlag — invalid type → throws", async () => {
        await expect(svc.createFlag({} as any, "my-flag", "xml")).rejects.toThrow("Invalid flag type");
    });

    it("U-FLAG-06: createFlag — all valid types accepted", async () => {
        flagRepo.save.mockResolvedValue({ id: "f-1", key: "flag", type: "string" });
        for (const type of ["boolean", "string", "number", "json"]) {
            await svc.createFlag({ id: "p-1" } as any, "flag", type);
        }
        expect(flagRepo.save).toHaveBeenCalledTimes(4);
    });

    it("U-FLAG-07: createFlag — key with leading/trailing spaces fails regex (spaces not allowed)", async () => {
        // The service calls trim() for the length check but runs regex on the raw key before trimming.
        // Spaces are not in [a-z0-9-], so a key with spaces should throw.
        await expect(svc.createFlag({ id: "p-1" } as any, "  my-flag  ")).rejects.toThrow("lowercase letters");
    });

    // --- listFlags ---

    it("U-FLAG-08: listFlags — returns array scoped to projectId", async () => {
        flagRepo.find.mockResolvedValue([{ id: "f-1" }, { id: "f-2" }]);
        const result = await svc.listFlags("p-1");
        expect(result).toHaveLength(2);
        expect(flagRepo.find).toHaveBeenCalledWith({ where: { project: { id: "p-1" } } });
    });

    // --- getFlag ---

    it("U-FLAG-09: getFlag — existing id → returns flag with project relation", async () => {
        flagRepo.findOne.mockResolvedValue({ id: "f-1", project: { id: "p-1" } });
        const result = await svc.getFlag("f-1");
        expect(result?.id).toBe("f-1");
        expect(flagRepo.findOne).toHaveBeenCalledWith({ where: { id: "f-1" }, relations: ["project"] });
    });

    it("U-FLAG-10: getFlag — not found → returns null", async () => {
        flagRepo.findOne.mockResolvedValue(null);
        expect(await svc.getFlag("missing")).toBeNull();
    });

    // --- updateFlag ---

    it("U-FLAG-11: updateFlag — updates description and type", async () => {
        const flag = { id: "f-1", key: "flag", type: "boolean", description: "old", project: { id: "p-1" } };
        flagRepo.findOne.mockResolvedValue({ ...flag });
        flagRepo.save.mockImplementation(async (f: any) => f);

        const result = await svc.updateFlag("f-1", { description: "new desc", type: "string" });

        expect(result.description).toBe("new desc");
        expect(result.type).toBe("string");
    });

    it("U-FLAG-12: updateFlag — flag not found → throws", async () => {
        flagRepo.findOne.mockResolvedValue(null);
        await expect(svc.updateFlag("missing", { description: "x" })).rejects.toThrow("Flag not found");
    });

    it("U-FLAG-13: updateFlag — invalid type → throws", async () => {
        flagRepo.findOne.mockResolvedValue({ id: "f-1", project: {} });
        await expect(svc.updateFlag("f-1", { type: "xml" })).rejects.toThrow("Invalid type");
    });

    // --- deleteFlag ---

    it("U-FLAG-14: deleteFlag — affected > 0 → returns true", async () => {
        flagRepo.delete.mockResolvedValue({ affected: 1 });
        expect(await svc.deleteFlag("f-1")).toBe(true);
    });

    it("U-FLAG-15: deleteFlag — affected = 0 → returns false", async () => {
        flagRepo.delete.mockResolvedValue({ affected: 0 });
        expect(await svc.deleteFlag("missing")).toBe(false);
    });
});
