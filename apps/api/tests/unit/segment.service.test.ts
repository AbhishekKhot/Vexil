import "reflect-metadata";
// Unit tests: SegmentService
import { describe, it, expect, vi, beforeEach } from "vitest";
import { SegmentService } from "../../src/services/SegmentService";

const makeSegmentRepo = () => ({
    create: vi.fn((data: any) => data),
    save: vi.fn(),
    find: vi.fn(),
    findOne: vi.fn(),
    delete: vi.fn(),
});

describe("SegmentService", () => {
    let segmentRepo: ReturnType<typeof makeSegmentRepo>;
    let svc: SegmentService;

    beforeEach(() => {
        vi.resetAllMocks();
        segmentRepo = makeSegmentRepo();
        svc = new SegmentService(segmentRepo as any);
    });

    // --- createSegment ---

    it("U-SEG-01: createSegment — valid inputs → saves and returns segment", async () => {
        const project = { id: "p-1" } as any;
        const rules = { conditions: [{ attribute: "country", operator: "eq", values: ["US"] }] };
        segmentRepo.save.mockResolvedValue({ id: "s-1", name: "US Users", rules });

        const result = await svc.createSegment(project, "US Users", rules);

        expect(segmentRepo.create).toHaveBeenCalledWith(expect.objectContaining({ name: "US Users", rules }));
        expect(segmentRepo.save).toHaveBeenCalledTimes(1);
    });

    it("U-SEG-02: createSegment — name too short (1 char) → throws", async () => {
        await expect(svc.createSegment({} as any, "x", {})).rejects.toThrow("at least 2 characters");
    });

    it("U-SEG-03: createSegment — empty name → throws", async () => {
        await expect(svc.createSegment({} as any, "", {})).rejects.toThrow();
    });

    it("U-SEG-04: createSegment — null rules → throws", async () => {
        await expect(svc.createSegment({} as any, "My Segment", null)).rejects.toThrow("valid targeting rules");
    });

    it("U-SEG-05: createSegment — non-object rules (string) → throws", async () => {
        await expect(svc.createSegment({} as any, "My Segment", "bad-rules")).rejects.toThrow();
    });

    it("U-SEG-06: createSegment — trims whitespace from name", async () => {
        segmentRepo.save.mockResolvedValue({ id: "s-1" });
        await svc.createSegment({ id: "p-1" } as any, "  My Segment  ", {});
        expect(segmentRepo.create).toHaveBeenCalledWith(expect.objectContaining({ name: "My Segment" }));
    });

    // --- listSegments ---

    it("U-SEG-07: listSegments — returns array for projectId", async () => {
        segmentRepo.find.mockResolvedValue([{ id: "s-1" }, { id: "s-2" }]);
        const result = await svc.listSegments("p-1");
        expect(result).toHaveLength(2);
        expect(segmentRepo.find).toHaveBeenCalledWith({ where: { project: { id: "p-1" } } });
    });

    // --- getSegment ---

    it("U-SEG-08: getSegment — existing id → returns segment with project relation", async () => {
        segmentRepo.findOne.mockResolvedValue({ id: "s-1", project: { id: "p-1" } });
        const result = await svc.getSegment("s-1");
        expect(result ?.id).toBe("s-1");
        expect(segmentRepo.findOne).toHaveBeenCalledWith({ where: { id: "s-1" }, relations: ["project"] });
    });

    it("U-SEG-09: getSegment — not found → returns null", async () => {
        segmentRepo.findOne.mockResolvedValue(null);
        expect(await svc.getSegment("missing")).toBeNull();
    });

    // --- updateSegment ---

    it("U-SEG-10: updateSegment — updates name, description, and rules", async () => {
        const seg = { id: "s-1", name: "Old Name", description: "old", rules: {}, project: { id: "p-1" } };
        segmentRepo.findOne.mockResolvedValue({ ...seg });
        segmentRepo.save.mockImplementation(async (s: any) => s);

        const newRules = { conditions: [] };
        const result = await svc.updateSegment("s-1", { name: "New Name", description: "new desc", rules: newRules });

        expect(result.name).toBe("New Name");
        expect(result.description).toBe("new desc");
        expect(result.rules).toEqual(newRules);
    });

    it("U-SEG-11: updateSegment — segment not found → throws", async () => {
        segmentRepo.findOne.mockResolvedValue(null);
        await expect(svc.updateSegment("missing", { name: "X" })).rejects.toThrow("Segment not found");
    });

    it("U-SEG-12: updateSegment — name too short → throws", async () => {
        segmentRepo.findOne.mockResolvedValue({ id: "s-1", project: {} });
        await expect(svc.updateSegment("s-1", { name: "x" })).rejects.toThrow("at least 2 characters");
    });

    it("U-SEG-13: updateSegment — invalid rules (non-object) → throws", async () => {
        segmentRepo.findOne.mockResolvedValue({ id: "s-1", project: {} });
        await expect(svc.updateSegment("s-1", { rules: "bad" })).rejects.toThrow("Invalid rules");
    });

    // --- deleteSegment ---

    it("U-SEG-14: deleteSegment — affected > 0 → returns true", async () => {
        segmentRepo.delete.mockResolvedValue({ affected: 1 });
        expect(await svc.deleteSegment("s-1")).toBe(true);
    });

    it("U-SEG-15: deleteSegment — affected = 0 → returns false", async () => {
        segmentRepo.delete.mockResolvedValue({ affected: 0 });
        expect(await svc.deleteSegment("missing")).toBe(false);
    });
});
