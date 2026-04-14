// Integration tests: Project routes (I-P-01..10)
import "reflect-metadata";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import Fastify, { FastifyInstance } from "fastify";
import * as jwt from "jsonwebtoken";
import { TEST_JWT_SECRET, signToken } from "../helpers/buildTestApp";
import { UserRole } from "../../src/entities/User";
import { requireRole } from "../../src/middleware/rbacMiddleware";
import { ProjectController } from "../../src/controllers/ProjectController";

function buildProjectServiceMock() {
    return {
        createProject: vi.fn(),
        listProjects: vi.fn(),
        getProject: vi.fn(),
        deleteProject: vi.fn(),
    };
}

async function buildApp(projectService: ReturnType<typeof buildProjectServiceMock>) {
    process.env.JWT_SECRET = TEST_JWT_SECRET;
    const app = Fastify({ logger: false });

    app.decorate("authenticate", async (req: any, reply: any) => {
        const auth = req.headers.authorization;
        if (!auth ?.startsWith("Bearer ")) return reply.code(401).send({ error: "Unauthorized" });
        try {
            const payload = jwt.verify(auth.slice(7), TEST_JWT_SECRET) as any;
            req.user = { id: payload.userId, email: payload.email, organizationId: payload.organizationId, role: payload.role };
        } catch { return reply.code(401).send({ error: "Unauthorized" }); }
    });

    const ctrl = new ProjectController(projectService as any);
    const adminOnly = requireRole([UserRole.ADMIN]);
    const adminOrMember = requireRole([UserRole.ADMIN, UserRole.MEMBER]);

    app.addHook("onRequest", (app as any).authenticate);

    app.post("/api/projects", { preHandler: [adminOrMember] }, ctrl.createProject as any);
    app.get("/api/projects", {}, ctrl.listProjects as any);
    app.get("/api/projects/:id", {}, ctrl.getProject as any);
    app.delete("/api/projects/:id", { preHandler: [adminOnly] }, ctrl.deleteProject as any);

    await app.ready();
    return app;
}

describe("Integration: Project Routes", () => {
    let app: FastifyInstance;
    let projectService: ReturnType<typeof buildProjectServiceMock>;

    beforeEach(async () => {
        projectService = buildProjectServiceMock();
        app = await buildApp(projectService);
    });

    afterEach(async () => { await app.close(); });

    it("I-P-01: POST / — ADMIN creates project → 201", async () => {
        projectService.createProject.mockResolvedValue({ id: "p-1", name: "My Project" });
        const res = await app.inject({ method: "POST", url: "/api/projects", headers: { authorization: `Bearer ${signToken({ role: UserRole.ADMIN })}` }, payload: { name: "My Project" } });
        expect(res.statusCode).toBe(201);
    });

    it("I-P-02: POST / — VIEWER role → 403", async () => {
        const res = await app.inject({ method: "POST", url: "/api/projects", headers: { authorization: `Bearer ${signToken({ role: UserRole.VIEWER })}` }, payload: { name: "My Project" } });
        expect(res.statusCode).toBe(403);
    });

    it("I-P-03: POST / — missing name → 400 (service throws)", async () => {
        projectService.createProject.mockRejectedValue(new Error("Name is required"));
        const res = await app.inject({ method: "POST", url: "/api/projects", headers: { authorization: `Bearer ${signToken()}` }, payload: {} });
        expect(res.statusCode).toBe(400);
    });

    it("I-P-04: GET / — lists only projects in user's org → 200, array", async () => {
        projectService.listProjects.mockResolvedValue([{ id: "p-1" }, { id: "p-2" }]);
        const res = await app.inject({ method: "GET", url: "/api/projects", headers: { authorization: `Bearer ${signToken()}` } });
        expect(res.statusCode).toBe(200);
        expect(Array.isArray(res.json())).toBe(true);
    });

    it("I-P-05: GET /:id — project in same org → 200", async () => {
        projectService.getProject.mockResolvedValue({ id: "p-1", name: "My Project" });
        const res = await app.inject({ method: "GET", url: "/api/projects/p-1", headers: { authorization: `Bearer ${signToken()}` } });
        expect(res.statusCode).toBe(200);
    });

    it("I-P-06: GET /:id — project in different org → 404", async () => {
        projectService.getProject.mockResolvedValue(null);
        const res = await app.inject({ method: "GET", url: "/api/projects/p-999", headers: { authorization: `Bearer ${signToken()}` } });
        expect(res.statusCode).toBe(404);
    });

    it("I-P-07: GET /:id — no JWT → 401", async () => {
        const res = await app.inject({ method: "GET", url: "/api/projects/p-1" });
        expect(res.statusCode).toBe(401);
    });

    it("I-P-08: DELETE /:id — ADMIN → 204", async () => {
        projectService.deleteProject.mockResolvedValue(true);
        const res = await app.inject({ method: "DELETE", url: "/api/projects/p-1", headers: { authorization: `Bearer ${signToken({ role: UserRole.ADMIN })}` } });
        expect(res.statusCode).toBe(204);
    });

    it("I-P-09: DELETE /:id — MEMBER → 403", async () => {
        const res = await app.inject({ method: "DELETE", url: "/api/projects/p-1", headers: { authorization: `Bearer ${signToken({ role: UserRole.MEMBER })}` } });
        expect(res.statusCode).toBe(403);
    });

    it("I-P-10: DELETE /:id — unknown id → 404", async () => {
        projectService.deleteProject.mockResolvedValue(false);
        const res = await app.inject({ method: "DELETE", url: "/api/projects/unknown", headers: { authorization: `Bearer ${signToken({ role: UserRole.ADMIN })}` } });
        expect(res.statusCode).toBe(404);
    });
});
