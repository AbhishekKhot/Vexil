import "reflect-metadata";
// Unit tests: ProjectService
import { describe, it, expect, vi, beforeEach } from "vitest";
import { ProjectService } from "../../src/services/ProjectService";

const makeProjectRepo = () => ({
    create: vi.fn((data: any) => data),
    save: vi.fn(),
    find: vi.fn(),
    findOne: vi.fn(),
    delete: vi.fn(),
});

describe("ProjectService", () => {
    let projectRepo: ReturnType<typeof makeProjectRepo>;
    let svc: ProjectService;

    beforeEach(() => {
        vi.resetAllMocks();
        projectRepo = makeProjectRepo();
        svc = new ProjectService(projectRepo as any);
    });

    // --- createProject ---

    it("U-PROJ-01: createProject — valid name → saves and returns project", async () => {
        projectRepo.save.mockResolvedValue({ id: "p-1", name: "My Project", organizationId: "org-1" });

        const result = await svc.createProject("org-1", "My Project");

        expect(projectRepo.create).toHaveBeenCalledWith(expect.objectContaining({ organizationId: "org-1", name: "My Project" }));
        expect(projectRepo.save).toHaveBeenCalledTimes(1);
    });

    it("U-PROJ-02: createProject — name too short (2 chars) → throws", async () => {
        await expect(svc.createProject("org-1", "ab")).rejects.toThrow("at least 3 characters");
    });

    it("U-PROJ-03: createProject — empty name → throws", async () => {
        await expect(svc.createProject("org-1", "")).rejects.toThrow();
    });

    it("U-PROJ-04: createProject — trims whitespace from name", async () => {
        projectRepo.save.mockResolvedValue({ id: "p-1", name: "My Project" });
        await svc.createProject("org-1", "  My Project  ");
        expect(projectRepo.create).toHaveBeenCalledWith(expect.objectContaining({ name: "My Project" }));
    });

    it("U-PROJ-05: createProject — description trimmed if provided", async () => {
        projectRepo.save.mockResolvedValue({ id: "p-1" });
        await svc.createProject("org-1", "My Project", "  A description  ");
        expect(projectRepo.create).toHaveBeenCalledWith(expect.objectContaining({ description: "A description" }));
    });

    // --- listProjects ---

    it("U-PROJ-06: listProjects — returns projects for org, ordered DESC", async () => {
        projectRepo.find.mockResolvedValue([{ id: "p-2" }, { id: "p-1" }]);

        const result = await svc.listProjects("org-1");

        expect(result).toHaveLength(2);
        expect(projectRepo.find).toHaveBeenCalledWith({
            where: { organizationId: "org-1" },
            order: { createdAt: "DESC" },
        });
    });

    // --- getProject ---

    it("U-PROJ-07: getProject — with organizationId filter → applies both constraints", async () => {
        projectRepo.findOne.mockResolvedValue({ id: "p-1", organizationId: "org-1" });

        const result = await svc.getProject("p-1", "org-1");

        expect(result ?.id).toBe("p-1");
        expect(projectRepo.findOne).toHaveBeenCalledWith({
            where: expect.objectContaining({ id: "p-1", organizationId: "org-1" }),
        });
    });

    it("U-PROJ-08: getProject — without organizationId → omits org filter", async () => {
        projectRepo.findOne.mockResolvedValue({ id: "p-1" });

        await svc.getProject("p-1");

        const whereArg = projectRepo.findOne.mock.calls[0][0].where;
        expect(whereArg.organizationId).toBeUndefined();
    });

    it("U-PROJ-09: getProject — not found → returns null", async () => {
        projectRepo.findOne.mockResolvedValue(null);
        expect(await svc.getProject("missing", "org-1")).toBeNull();
    });

    // --- deleteProject ---

    it("U-PROJ-10: deleteProject — affected > 0 → returns true", async () => {
        projectRepo.delete.mockResolvedValue({ affected: 1 });
        expect(await svc.deleteProject("p-1", "org-1")).toBe(true);
        expect(projectRepo.delete).toHaveBeenCalledWith({ id: "p-1", organizationId: "org-1" });
    });

    it("U-PROJ-11: deleteProject — affected = 0 → returns false", async () => {
        projectRepo.delete.mockResolvedValue({ affected: 0 });
        expect(await svc.deleteProject("p-missing", "org-1")).toBe(false);
    });
});
