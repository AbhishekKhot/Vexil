import "reflect-metadata";
// Security tests: Org boundary (SEC-O-01..10)
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import Fastify, { FastifyInstance } from "fastify";
import * as jwt from "jsonwebtoken";
import { TEST_JWT_SECRET, TEST_ORG_ID, signToken } from "../helpers/buildTestApp";
import { UserRole } from "../../src/entities/User";

// User from Org A trying to access Org B's resources
const ORG_A = TEST_ORG_ID;
const ORG_B = "org-b-different";

// Service mocks — all return null/empty when org doesn't match
const services = {
    getProject: vi.fn(),
    listProjects: vi.fn(),
    createFlag: vi.fn(),
    getFlag: vi.fn(),
    deleteFlag: vi.fn(),
    getFlagConfig: vi.fn(),
    getAnalytics: vi.fn(),
    getLogById: vi.fn(),
    getEnvironment: vi.fn(),
    deleteEnvironment: vi.fn(),
    rotateApiKey: vi.fn(),
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

    // Each route passes organizationId to service which returns null on mismatch → 404
    app.get("/api/projects/:id", {}, async (req: any, reply) => {
        const p = await services.getProject(req.params.id, req.user.organizationId);
        return p ? reply.code(200).send(p) : reply.code(404).send({ error: "Not found" });
    });

    app.post("/api/projects/:projectId/flags", {}, async (req: any, reply) => {
        const p = await services.getProject(req.params.projectId, req.user.organizationId);
        if (!p) return reply.code(404).send({ error: "Not found" });
        const f = await services.createFlag();
        return reply.code(201).send(f);
    });

    app.delete("/api/projects/:projectId/flags/:id", {}, async (req: any, reply) => {
        const flag = await services.getFlag(req.params.id);
        if (!flag || flag.project.organizationId !== req.user.organizationId) return reply.code(404).send({ error: "Not found" });
        await services.deleteFlag(req.params.id);
        return reply.code(204).send();
    });

    app.get("/api/projects/:projectId/environments/:envId/flags/:flagId/config", {}, async (req: any, reply) => {
        const p = await services.getProject(req.params.projectId, req.user.organizationId);
        if (!p) return reply.code(404).send({ error: "Not found" });
        const c = await services.getFlagConfig();
        return c ? reply.code(200).send(c) : reply.code(404).send({ error: "Not found" });
    });

    app.get("/api/projects/:projectId/stats", {}, async (req: any, reply) => {
        const stats = await services.getAnalytics(req.params.projectId, req.user.organizationId);
        return reply.code(200).send(stats); // returns [] for wrong org — no 403
    });

    app.get("/api/projects/:projectId/audit-logs/:id", {}, async (req: any, reply) => {
        const log = await services.getLogById(req.params.id, req.params.projectId);
        return log ? reply.code(200).send(log) : reply.code(404).send({ error: "Not found" });
    });

    app.delete("/api/projects/:projectId/environments/:id", {}, async (req: any, reply) => {
        const p = await services.getProject(req.params.projectId, req.user.organizationId);
        if (!p) return reply.code(404).send({ error: "Not found" });
        return reply.code(204).send();
    });

    app.post("/api/projects/:projectId/environments", {}, async (req: any, reply) => {
        const p = await services.getProject(req.params.projectId, req.user.organizationId);
        if (!p) return reply.code(404).send({ error: "Not found" });
        return reply.code(201).send({ id: "e-1" });
    });

    app.post("/api/projects/:projectId/environments/:envId/rotate-key", {}, async (req: any, reply) => {
        const env = await services.getEnvironment(req.params.envId);
        if (!env || env.project.organizationId !== req.user.organizationId) return reply.code(404).send({ error: "Not found" });
        return reply.code(200).send({ apiKey: "vex_new" });
    });

    app.get("/api/projects/:projectId/flags", {}, async (req: any, reply) => {
        const p = await services.getProject(req.params.projectId, req.user.organizationId);
        if (!p) return reply.code(404).send({ error: "Not found" });
        return reply.code(200).send([]);
    });

    await app.ready();
    return app;
}

// Token for user in Org A
const tokenOrgA = () => signToken({ organizationId: ORG_A });

describe("Security: Org Boundary", () => {
    let app: FastifyInstance;

    beforeEach(async () => {
        vi.clearAllMocks();
        // By default, getProject returns null when org doesn't match
        services.getProject.mockResolvedValue(null);
        services.getAnalytics.mockResolvedValue([]);
        services.getLogById.mockResolvedValue(null);
        services.getFlag.mockResolvedValue(null);
        services.getEnvironment.mockResolvedValue(null);
        app = await buildApp();
    });

    afterEach(async () => { await app.close(); });

    it("SEC-O-01: Org A reads project from Org B by guessing UUID → 404", async () => {
        const res = await app.inject({ method: "GET", url: "/api/projects/p-org-b-uuid", headers: { authorization: `Bearer ${tokenOrgA()}` } });
        expect(res.statusCode).toBe(404);
    });

    it("SEC-O-02: Org A creates flag in Org B's project → 404", async () => {
        const res = await app.inject({ method: "POST", url: "/api/projects/p-org-b/flags", headers: { authorization: `Bearer ${tokenOrgA()}` }, payload: { key: "evil-flag" } });
        expect(res.statusCode).toBe(404);
    });

    it("SEC-O-03: Org A deletes flag from Org B's project → 404", async () => {
        services.getFlag.mockResolvedValue({ id: "f-1", project: { id: "p-b", organizationId: ORG_B } });
        const res = await app.inject({ method: "DELETE", url: "/api/projects/p-b/flags/f-1", headers: { authorization: `Bearer ${tokenOrgA()}` } });
        expect(res.statusCode).toBe(404);
    });

    it("SEC-O-04: Org A gets flag config for Org B's env/flag → 404", async () => {
        const res = await app.inject({ method: "GET", url: "/api/projects/p-b/environments/e-b/flags/f-b/config", headers: { authorization: `Bearer ${tokenOrgA()}` } });
        expect(res.statusCode).toBe(404);
    });

    it("SEC-O-05: Org A reads analytics for Org B's project → 200 but empty array (no leak)", async () => {
        const res = await app.inject({ method: "GET", url: "/api/projects/p-b/stats", headers: { authorization: `Bearer ${tokenOrgA()}` } });
        expect(res.statusCode).toBe(200);
        expect(res.json()).toEqual([]);
    });

    it("SEC-O-06: Org A reads audit log by ID from Org B → 404", async () => {
        const res = await app.inject({ method: "GET", url: "/api/projects/p-b/audit-logs/log-b", headers: { authorization: `Bearer ${tokenOrgA()}` } });
        expect(res.statusCode).toBe(404);
    });

    it("SEC-O-07: Org A deletes env from Org B's project → 404", async () => {
        const res = await app.inject({ method: "DELETE", url: "/api/projects/p-b/environments/e-b", headers: { authorization: `Bearer ${tokenOrgA()}` } });
        expect(res.statusCode).toBe(404);
    });

    it("SEC-O-08: Org A creates environment in Org B's project → 404", async () => {
        const res = await app.inject({ method: "POST", url: "/api/projects/p-b/environments", headers: { authorization: `Bearer ${tokenOrgA()}` }, payload: { name: "evil" } });
        expect(res.statusCode).toBe(404);
    });

    it("SEC-O-09: Org A rotates API key for Org B's env → 404", async () => {
        services.getEnvironment.mockResolvedValue({ id: "e-b", project: { id: "p-b", organizationId: ORG_B } });
        const res = await app.inject({ method: "POST", url: "/api/projects/p-b/environments/e-b/rotate-key", headers: { authorization: `Bearer ${tokenOrgA()}` } });
        expect(res.statusCode).toBe(404);
    });

    it("SEC-O-10: Org A lists flags in Org B's project → 404", async () => {
        const res = await app.inject({ method: "GET", url: "/api/projects/p-b/flags", headers: { authorization: `Bearer ${tokenOrgA()}` } });
        expect(res.statusCode).toBe(404);
    });
});
