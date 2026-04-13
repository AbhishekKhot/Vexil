import "reflect-metadata";
// Security tests: RBAC (SEC-R-01..10)
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import Fastify, { FastifyInstance } from "fastify";
import * as jwt from "jsonwebtoken";
import { TEST_JWT_SECRET, signToken } from "../helpers/buildTestApp";
import { UserRole } from "../../src/entities/User";
import { requireRole } from "../../src/middleware/rbacMiddleware";

const mockServices: Record<string, vi.Mock> = {
    createProject: vi.fn().mockResolvedValue({ id: "p-1" }),
    deleteProject: vi.fn().mockResolvedValue(true),
    createFlag: vi.fn().mockResolvedValue({ id: "f-1" }),
    deleteFlag: vi.fn().mockResolvedValue(true),
    getFlag: vi.fn().mockResolvedValue({ id: "f-1", project: { id: "p-1" } }),
    setFlagConfig: vi.fn().mockResolvedValue({}),
    getFlagConfig: vi.fn().mockResolvedValue({ id: "c-1" }),
    createEnvironment: vi.fn().mockResolvedValue({ id: "e-1" }),
    deleteEnvironment: vi.fn().mockResolvedValue(true),
    getEnvironment: vi.fn().mockResolvedValue({ id: "e-1", project: { id: "p-1" } }),
    rotateApiKey: vi.fn().mockResolvedValue({ apiKey: "vex_new" }),
    getProject: vi.fn().mockResolvedValue({ id: "p-1" }),
};

async function buildApp() {
    process.env.JWT_SECRET = TEST_JWT_SECRET;
    const app = Fastify({ logger: false });

    app.decorate("authenticate", async (req: any, reply: any) => {
        const auth = req.headers.authorization;
        if (!auth?.startsWith("Bearer ")) return reply.code(401).send({ error: "Unauthorized" });
        try {
            const payload = jwt.verify(auth.slice(7), TEST_JWT_SECRET) as any;
            req.user = { id: payload.userId, email: payload.email, organizationId: payload.organizationId, role: payload.role };
        } catch { return reply.code(401).send({ error: "Unauthorized" }); }
    });

    app.addHook("onRequest", (app as any).authenticate);

    const adminOnly    = requireRole([UserRole.ADMIN]);
    const adminOrMember = requireRole([UserRole.ADMIN, UserRole.MEMBER]);

    // Projects
    app.post("/api/projects", { preHandler: [adminOrMember] }, async (_req: any, reply) => reply.code(201).send(mockServices.createProject()));
    app.delete("/api/projects/:id", { preHandler: [adminOnly] }, async (_req: any, reply) => reply.code(204).send());

    // Flags
    app.post("/api/projects/:projectId/flags", { preHandler: [adminOrMember] }, async (_req: any, reply) => {
        mockServices.getProject();
        return reply.code(201).send(mockServices.createFlag());
    });
    app.delete("/api/projects/:projectId/flags/:id", { preHandler: [adminOnly] }, async (req: any, reply) => {
        const flag = mockServices.getFlag();
        if (!flag) return reply.code(404).send({});
        mockServices.deleteFlag();
        return reply.code(204).send();
    });

    // Flag config
    app.put("/api/projects/:projectId/environments/:environmentId/flags/:flagId", { preHandler: [adminOrMember] }, async (_req: any, reply) => reply.code(200).send(mockServices.setFlagConfig()));

    // Environments
    app.post("/api/projects/:projectId/environments", { preHandler: [adminOrMember] }, async (_req: any, reply) => reply.code(201).send(mockServices.createEnvironment()));
    app.post("/api/projects/:projectId/environments/:envId/rotate-key", { preHandler: [adminOnly] }, async (_req: any, reply) => reply.code(200).send({ apiKey: "vex_new" }));
    app.delete("/api/projects/:projectId/environments/:id", { preHandler: [adminOnly] }, async (_req: any, reply) => reply.code(204).send());

    await app.ready();
    return app;
}

describe("Security: RBAC", () => {
    let app: FastifyInstance;

    beforeEach(async () => {
        vi.clearAllMocks();
        app = await buildApp();
    });

    afterEach(async () => { await app.close(); });

    it("SEC-R-01: VIEWER tries to create project → 403", async () => {
        const res = await app.inject({ method: "POST", url: "/api/projects", headers: { authorization: `Bearer ${signToken({ role: UserRole.VIEWER })}` }, payload: { name: "P" } });
        expect(res.statusCode).toBe(403);
    });

    it("SEC-R-02: VIEWER tries to create flag → 403", async () => {
        const res = await app.inject({ method: "POST", url: "/api/projects/p-1/flags", headers: { authorization: `Bearer ${signToken({ role: UserRole.VIEWER })}` }, payload: { key: "f" } });
        expect(res.statusCode).toBe(403);
    });

    it("SEC-R-03: VIEWER tries to delete flag → 403", async () => {
        const res = await app.inject({ method: "DELETE", url: "/api/projects/p-1/flags/f-1", headers: { authorization: `Bearer ${signToken({ role: UserRole.VIEWER })}` } });
        expect(res.statusCode).toBe(403);
    });

    it("SEC-R-04: VIEWER tries to PUT flag config → 403", async () => {
        const res = await app.inject({ method: "PUT", url: "/api/projects/p-1/environments/e-1/flags/f-1", headers: { authorization: `Bearer ${signToken({ role: UserRole.VIEWER })}` }, payload: { isEnabled: true } });
        expect(res.statusCode).toBe(403);
    });

    it("SEC-R-05: VIEWER tries to create environment → 403", async () => {
        const res = await app.inject({ method: "POST", url: "/api/projects/p-1/environments", headers: { authorization: `Bearer ${signToken({ role: UserRole.VIEWER })}` }, payload: { name: "env" } });
        expect(res.statusCode).toBe(403);
    });

    it("SEC-R-06: VIEWER tries to rotate API key → 403", async () => {
        const res = await app.inject({ method: "POST", url: "/api/projects/p-1/environments/e-1/rotate-key", headers: { authorization: `Bearer ${signToken({ role: UserRole.VIEWER })}` } });
        expect(res.statusCode).toBe(403);
    });

    it("SEC-R-07: MEMBER tries to delete project → 403", async () => {
        const res = await app.inject({ method: "DELETE", url: "/api/projects/p-1", headers: { authorization: `Bearer ${signToken({ role: UserRole.MEMBER })}` } });
        expect(res.statusCode).toBe(403);
    });

    it("SEC-R-08: MEMBER tries to delete environment → 403", async () => {
        const res = await app.inject({ method: "DELETE", url: "/api/projects/p-1/environments/e-1", headers: { authorization: `Bearer ${signToken({ role: UserRole.MEMBER })}` } });
        expect(res.statusCode).toBe(403);
    });

    it("SEC-R-09: MEMBER can create flag → 201 (allowed)", async () => {
        const res = await app.inject({ method: "POST", url: "/api/projects/p-1/flags", headers: { authorization: `Bearer ${signToken({ role: UserRole.MEMBER })}` }, payload: { key: "flag" } });
        expect(res.statusCode).toBe(201);
    });

    it("SEC-R-10: ADMIN can delete project → 204", async () => {
        const res = await app.inject({ method: "DELETE", url: "/api/projects/p-1", headers: { authorization: `Bearer ${signToken({ role: UserRole.ADMIN })}` } });
        expect(res.statusCode).toBe(204);
    });
});
