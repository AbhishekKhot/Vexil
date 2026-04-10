import "reflect-metadata";
// Integration tests: Environment routes (I-E-01..10)
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import Fastify, { FastifyInstance } from "fastify";
import * as jwt from "jsonwebtoken";
import { TEST_JWT_SECRET, TEST_ORG_ID, signToken } from "../helpers/buildTestApp";
import { UserRole } from "../../src/entities/User";
import { requireRole } from "../../src/middleware/rbacMiddleware";
import { EnvironmentController } from "../../src/controllers/EnvironmentController";

const mockEnvService = {
    createEnvironment: vi.fn(),
    listEnvironments: vi.fn(),
    getEnvironment: vi.fn(),
    rotateApiKey: vi.fn(),
    deleteEnvironment: vi.fn(),
};

const mockProjectService = {
    getProject: vi.fn(),
};

vi.mock("../../src/services/EnvironmentService", () => ({
    EnvironmentService: vi.fn().mockImplementation(() => mockEnvService),
}));

vi.mock("../../src/services/ProjectService", () => ({
    ProjectService: vi.fn().mockImplementation(() => mockProjectService),
}));

async function buildApp() {
    process.env.JWT_SECRET = TEST_JWT_SECRET;
    const app = Fastify({ logger: false });
    app.decorate("orm", { getRepository: vi.fn().mockReturnValue({}) });

    app.decorate("authenticate", async (req: any, reply: any) => {
        const auth = req.headers.authorization;
        if (!auth?.startsWith("Bearer ")) return reply.code(401).send({ error: "Unauthorized" });
        try {
            const payload = jwt.verify(auth.slice(7), TEST_JWT_SECRET) as any;
            req.user = { id: payload.userId, email: payload.email, organizationId: payload.organizationId, role: payload.role };
        } catch { return reply.code(401).send({ error: "Unauthorized" }); }
    });

    const ctrl = new EnvironmentController(mockEnvService as any, mockProjectService as any);
    const adminOnly = requireRole([UserRole.ADMIN]);
    const adminOrMember = requireRole([UserRole.ADMIN, UserRole.MEMBER]);

    app.addHook("onRequest", (app as any).authenticate);

    const base = "/api/projects/:projectId/environments";
    app.post(base, { preHandler: [adminOrMember] }, ctrl.createEnvironment as any);
    app.get(base, {}, ctrl.listEnvironments as any);
    app.post(`${base}/:envId/rotate-key`, { preHandler: [adminOnly] }, ctrl.rotateApiKey as any);
    app.delete(`${base}/:id`, { preHandler: [adminOnly] }, ctrl.deleteEnvironment as any);

    await app.ready();
    return app;
}

describe("Integration: Environment Routes", () => {
    let app: FastifyInstance;

    beforeEach(async () => {
        vi.clearAllMocks();
        app = await buildApp();
    });

    afterEach(async () => { await app.close(); });

    it("I-E-01: POST — ADMIN creates env → 201", async () => {
        mockProjectService.getProject.mockResolvedValue({ id: "p-1", name: "Proj" });
        mockEnvService.createEnvironment.mockResolvedValue({ id: "e-1", name: "production", apiKey: "vex_abc" });
        const res = await app.inject({ method: "POST", url: "/api/projects/p-1/environments", headers: { authorization: `Bearer ${signToken({ role: UserRole.ADMIN })}` }, payload: { name: "production" } });
        expect(res.statusCode).toBe(201);
    });

    it("I-E-02: POST — VIEWER → 403", async () => {
        const res = await app.inject({ method: "POST", url: "/api/projects/p-1/environments", headers: { authorization: `Bearer ${signToken({ role: UserRole.VIEWER })}` }, payload: { name: "production" } });
        expect(res.statusCode).toBe(403);
    });

    it("I-E-03: POST — projectId belongs to different org → 404", async () => {
        mockProjectService.getProject.mockResolvedValue(null); // org mismatch
        const res = await app.inject({ method: "POST", url: "/api/projects/p-other/environments", headers: { authorization: `Bearer ${signToken()}` }, payload: { name: "production" } });
        expect(res.statusCode).toBe(404);
    });

    it("I-E-04: GET — lists envs for project → 200", async () => {
        mockProjectService.getProject.mockResolvedValue({ id: "p-1" });
        mockEnvService.listEnvironments.mockResolvedValue([{ id: "e-1" }, { id: "e-2" }]);
        const res = await app.inject({ method: "GET", url: "/api/projects/p-1/environments", headers: { authorization: `Bearer ${signToken()}` } });
        expect(res.statusCode).toBe(200);
        expect(Array.isArray(res.json())).toBe(true);
    });

    it("I-E-05: POST /rotate-key — ADMIN → 200, returns new apiKey", async () => {
        mockEnvService.getEnvironment.mockResolvedValue({ id: "e-1", project: { id: "p-1" } });
        mockEnvService.rotateApiKey.mockResolvedValue({ apiKey: "vex_newkey123" });
        const res = await app.inject({ method: "POST", url: "/api/projects/p-1/environments/e-1/rotate-key", headers: { authorization: `Bearer ${signToken({ role: UserRole.ADMIN })}` } });
        expect(res.statusCode).toBe(200);
        expect(res.json().apiKey).toBeDefined();
    });

    it("I-E-06: POST /rotate-key — env in wrong project → 404", async () => {
        mockEnvService.getEnvironment.mockResolvedValue({ id: "e-1", project: { id: "p-other" } });
        const res = await app.inject({ method: "POST", url: "/api/projects/p-1/environments/e-1/rotate-key", headers: { authorization: `Bearer ${signToken({ role: UserRole.ADMIN })}` } });
        expect(res.statusCode).toBe(404);
    });

    it("I-E-07: DELETE — ADMIN → 204", async () => {
        mockEnvService.getEnvironment.mockResolvedValue({ id: "e-1", project: { id: "p-1" } });
        mockEnvService.deleteEnvironment.mockResolvedValue(true);
        const res = await app.inject({ method: "DELETE", url: "/api/projects/p-1/environments/e-1", headers: { authorization: `Bearer ${signToken({ role: UserRole.ADMIN })}` } });
        expect(res.statusCode).toBe(204);
    });

    it("I-E-08: DELETE — MEMBER → 403", async () => {
        const res = await app.inject({ method: "DELETE", url: "/api/projects/p-1/environments/e-1", headers: { authorization: `Bearer ${signToken({ role: UserRole.MEMBER })}` } });
        expect(res.statusCode).toBe(403);
    });

    it("I-E-09: DELETE — env in wrong project → 404", async () => {
        mockEnvService.getEnvironment.mockResolvedValue({ id: "e-1", project: { id: "p-other" } });
        const res = await app.inject({ method: "DELETE", url: "/api/projects/p-1/environments/e-1", headers: { authorization: `Bearer ${signToken({ role: UserRole.ADMIN })}` } });
        expect(res.statusCode).toBe(404);
    });

    it("I-E-10: rotateApiKey response — only returns apiKey field", async () => {
        mockEnvService.getEnvironment.mockResolvedValue({ id: "e-1", project: { id: "p-1" } });
        mockEnvService.rotateApiKey.mockResolvedValue({ id: "e-1", apiKey: "vex_newkey", passwordHash: "should-not-appear", sensitiveField: "secret" });
        const res = await app.inject({ method: "POST", url: "/api/projects/p-1/environments/e-1/rotate-key", headers: { authorization: `Bearer ${signToken({ role: UserRole.ADMIN })}` } });
        expect(res.statusCode).toBe(200);
        const body = res.json();
        expect(Object.keys(body)).toEqual(["apiKey"]);
    });
});
