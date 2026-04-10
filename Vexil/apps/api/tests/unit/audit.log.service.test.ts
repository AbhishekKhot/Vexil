// Unit tests: AuditLogService (U-AL-01..06)
import { describe, it, expect, vi, beforeEach } from "vitest";
import { AuditLogService } from "../../src/services/AuditLogService";

const makeAuditLogRepo = () => ({
    save: vi.fn(),
    create: vi.fn(),
    createQueryBuilder: vi.fn(),
    findOne: vi.fn(),
});

describe("AuditLogService", () => {
    let repo: ReturnType<typeof makeAuditLogRepo>;
    let svc: AuditLogService;

    beforeEach(() => {
        vi.resetAllMocks();
        repo = makeAuditLogRepo();
        svc = new AuditLogService(repo as any);
    });

    it("U-AL-01: log() → creates and saves audit log entry", async () => {
        const entry = { id: "log-1", entityType: "Flag", entityId: "f-1", action: "update" };
        repo.create.mockReturnValue(entry);
        repo.save.mockResolvedValue(entry);

        const result = await svc.log({ entityType: "Flag", entityId: "f-1", action: "update" });

        expect(repo.create).toHaveBeenCalledTimes(1);
        expect(repo.save).toHaveBeenCalledTimes(1);
        expect(result).toEqual(entry);
    });

    it("U-AL-02: getLogs() — default pagination → skip=0, take=20", async () => {
        const qb = {
            where: vi.fn().mockReturnThis(),
            andWhere: vi.fn().mockReturnThis(),
            orderBy: vi.fn().mockReturnThis(),
            skip: vi.fn().mockReturnThis(),
            take: vi.fn().mockReturnThis(),
            getManyAndCount: vi.fn().mockResolvedValue([[], 0]),
        };
        repo.createQueryBuilder.mockReturnValue(qb);

        await svc.getLogs("proj-1");

        expect(qb.skip).toHaveBeenCalledWith(0); // (page 1 - 1) * 20
        expect(qb.take).toHaveBeenCalledWith(20);
    });

    it("U-AL-03: getLogs() — limit=200 → capped to 100", async () => {
        const qb = {
            where: vi.fn().mockReturnThis(),
            andWhere: vi.fn().mockReturnThis(),
            orderBy: vi.fn().mockReturnThis(),
            skip: vi.fn().mockReturnThis(),
            take: vi.fn().mockReturnThis(),
            getManyAndCount: vi.fn().mockResolvedValue([[], 0]),
        };
        repo.createQueryBuilder.mockReturnValue(qb);

        await svc.getLogs("proj-1", { limit: 200 });

        expect(qb.take).toHaveBeenCalledWith(100); // capped
    });

    it("U-AL-04: getLogs() — entityType filter applied", async () => {
        const qb = {
            where: vi.fn().mockReturnThis(),
            andWhere: vi.fn().mockReturnThis(),
            orderBy: vi.fn().mockReturnThis(),
            skip: vi.fn().mockReturnThis(),
            take: vi.fn().mockReturnThis(),
            getManyAndCount: vi.fn().mockResolvedValue([[], 0]),
        };
        repo.createQueryBuilder.mockReturnValue(qb);

        await svc.getLogs("proj-1", { entityType: "Flag" });

        expect(qb.andWhere).toHaveBeenCalledWith(
            expect.stringContaining("entityType"),
            expect.objectContaining({ entityType: "Flag" })
        );
    });

    it("U-AL-05: getLogById() — matching projectId in metadata → returns log", async () => {
        const log = { id: "log-1", metadata: { projectId: "proj-1" } };
        repo.findOne.mockResolvedValue(log);

        const result = await svc.getLogById("log-1", "proj-1");

        expect(result).toEqual(log);
    });

    it("U-AL-06: getLogById() — wrong projectId in metadata → returns null", async () => {
        const log = { id: "log-1", metadata: { projectId: "proj-other" } };
        repo.findOne.mockResolvedValue(log);

        const result = await svc.getLogById("log-1", "proj-1");

        expect(result).toBeNull();
    });
});
