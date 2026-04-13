// Unit tests: AnalyticsService (U-AN-01..10)
import "reflect-metadata";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { AnalyticsService } from "../../src/services/AnalyticsService";

const makeEnvRepo = () => ({ findOne: vi.fn() });
const makeEventRepo = () => ({
    insert: vi.fn().mockResolvedValue({}),
    createQueryBuilder: vi.fn(),
});
const makeProjectRepo = () => ({ findOne: vi.fn() });

describe("AnalyticsService", () => {
    let envRepo: ReturnType<typeof makeEnvRepo>;
    let eventRepo: ReturnType<typeof makeEventRepo>;
    let projectRepo: ReturnType<typeof makeProjectRepo>;
    let svc: AnalyticsService;

    beforeEach(() => {
        vi.resetAllMocks();
        envRepo = makeEnvRepo();
        eventRepo = makeEventRepo();
        projectRepo = makeProjectRepo();
        svc = new AnalyticsService(envRepo as any, eventRepo as any, projectRepo as any);
    });

    it("U-AN-01: valid API key + events → inserts rows", async () => {
        envRepo.findOne.mockResolvedValue({ id: "env-1", apiKey: "vex_abc" });
        const events = [{ flagKey: "my-flag", result: true }];

        const result = await svc.ingestEvents("vex_abc", events);

        expect(result).toBe(true);
        expect(eventRepo.insert).toHaveBeenCalledTimes(1);
    });

    it("U-AN-02: invalid API key → throws 'Invalid API Key'", async () => {
        envRepo.findOne.mockResolvedValue(null);

        await expect(svc.ingestEvents("bad-key", [{ flagKey: "f", result: true }]))
            .rejects.toThrow("Invalid API Key");
    });

    it("U-AN-03: empty array → returns false, no insert", async () => {
        envRepo.findOne.mockResolvedValue({ id: "env-1" });

        const result = await svc.ingestEvents("vex_abc", []);

        expect(result).toBe(false);
        expect(eventRepo.insert).not.toHaveBeenCalled();
    });

    it("U-AN-04: 501 events → throws 'Batch too large'", async () => {
        envRepo.findOne.mockResolvedValue({ id: "env-1" });
        const events = Array.from({ length: 501 }, (_, i) => ({ flagKey: `flag-${i}`, result: true }));

        await expect(svc.ingestEvents("vex_abc", events)).rejects.toThrow("Batch too large");
    });

    it("U-AN-05: context > 2KB → context stripped (null stored)", async () => {
        envRepo.findOne.mockResolvedValue({ id: "env-1" });
        const largeContext = { data: "x".repeat(3000) }; // > 2KB

        await svc.ingestEvents("vex_abc", [{ flagKey: "flag", result: true, context: largeContext }]);

        const insertedRows = eventRepo.insert.mock.calls[0][0] as any[];
        expect(insertedRows[0].context).toBeNull();
    });

    it("U-AN-06: missing flagKey → throws validation error", async () => {
        envRepo.findOne.mockResolvedValue({ id: "env-1" });

        await expect(
            svc.ingestEvents("vex_abc", [{ flagKey: "", result: true }])
        ).rejects.toThrow();
    });

    it("U-AN-07: result not boolean → throws validation error", async () => {
        envRepo.findOne.mockResolvedValue({ id: "env-1" });

        await expect(
            svc.ingestEvents("vex_abc", [{ flagKey: "flag", result: "yes" as any }])
        ).rejects.toThrow();
    });

    it("U-AN-08: getAnalytics — project NOT in org → returns empty array", async () => {
        projectRepo.findOne.mockResolvedValue(null); // org mismatch

        const result = await svc.getAnalytics("proj-1", "org-other");

        expect(result).toEqual([]);
        expect(eventRepo.createQueryBuilder).not.toHaveBeenCalled();
    });

    it("U-AN-09: getAnalytics — project in org → calls query builder", async () => {
        projectRepo.findOne.mockResolvedValue({ id: "proj-1" });
        const qb = {
            innerJoin: vi.fn().mockReturnThis(),
            select: vi.fn().mockReturnThis(),
            addSelect: vi.fn().mockReturnThis(),
            where: vi.fn().mockReturnThis(),
            andWhere: vi.fn().mockReturnThis(),
            groupBy: vi.fn().mockReturnThis(),
            getRawMany: vi.fn().mockResolvedValue([{ flagKey: "f", evaluations: "5", enabled: "3", disabled: "2", passRate: "60" }]),
        };
        eventRepo.createQueryBuilder.mockReturnValue(qb);

        const result = await svc.getAnalytics("proj-1", "org-1");

        expect(result).toHaveLength(1);
        expect(result[0].flagKey).toBe("f");
    });

    it("U-AN-10: getAnalytics — with environmentId filter → andWhere called", async () => {
        projectRepo.findOne.mockResolvedValue({ id: "proj-1" });
        const qb = {
            innerJoin: vi.fn().mockReturnThis(),
            select: vi.fn().mockReturnThis(),
            addSelect: vi.fn().mockReturnThis(),
            where: vi.fn().mockReturnThis(),
            andWhere: vi.fn().mockReturnThis(),
            groupBy: vi.fn().mockReturnThis(),
            getRawMany: vi.fn().mockResolvedValue([]),
        };
        eventRepo.createQueryBuilder.mockReturnValue(qb);

        await svc.getAnalytics("proj-1", "org-1", "env-42");

        expect(qb.andWhere).toHaveBeenCalledWith(expect.stringContaining("environmentId"), expect.objectContaining({ environmentId: "env-42" }));
    });
});
