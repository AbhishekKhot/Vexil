import "reflect-metadata";
// Integration tests: Audit Log routes (I-AL-01..08)
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import Fastify, { FastifyInstance } from "fastify";
import * as jwt from "jsonwebtoken";
import { TEST_JWT_SECRET, signToken } from "../helpers/buildTestApp";
import { UserRole } from "../../src/entities/User";
import { AuditLogController } from "../../src/controllers/AuditLogController";

const mockAuditLogService = {
    getLogs: vi.fn(),
    getLogById: vi.fn(),
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

    const ctrl = new AuditLogController(mockAuditLogService as any);

    app.addHook("onRequest", (app as any).authenticate);

    app.get("/api/projects/:projectId/audit-logs", {}, ctrl.getLogs as any);
    app.get("/api/projects/:projectId/audit-logs/:id", {}, ctrl.getLogById as any);

    await app.ready();
    return app;
}

describe("Integration: Audit Log Routes", () => {
    let app: FastifyInstance;

    beforeEach(async () => {
        vi.clearAllMocks();
        app = await buildApp();
    });

    afterEach(async () => { await app.close(); });

    it("I-AL-01: GET list — VIEWER → 200, paginated result", async () => {
        mockAuditLogService.getLogs.mockResolvedValue({ items: [], total: 0, page: 1, limit: 20 });
        const res = await app.inject({ method: "GET", url: "/api/projects/p-1/audit-logs", headers: { authorization: `Bearer ${signToken({ role: UserRole.VIEWER })}` } });
        expect(res.statusCode).toBe(200);
        const body = res.json();
        expect(body).toHaveProperty("items");
        expect(body).toHaveProperty("total");
    });

    it("I-AL-02: GET list — no JWT → 401", async () => {
        const res = await app.inject({ method: "GET", url: "/api/projects/p-1/audit-logs" });
        expect(res.statusCode).toBe(401);
    });

    it("I-AL-03: GET list — limit=200 → capped to 100 in call to service", async () => {
        mockAuditLogService.getLogs.mockResolvedValue({ items: [], total: 0, page: 1, limit: 100 });
        const res = await app.inject({ method: "GET", url: "/api/projects/p-1/audit-logs?limit=200", headers: { authorization: `Bearer ${signToken()}` } });
        expect(res.statusCode).toBe(200);
        // The controller caps limit to 100 before passing to service
        expect(mockAuditLogService.getLogs).toHaveBeenCalledWith(
            "p-1",
            expect.objectContaining({ limit: 100 })
        );
    });

    it("I-AL-04: GET list — page + limit query params parsed correctly", async () => {
        mockAuditLogService.getLogs.mockResolvedValue({ items: [], total: 0, page: 3, limit: 10 });
        const res = await app.inject({ method: "GET", url: "/api/projects/p-1/audit-logs?page=3&limit=10", headers: { authorization: `Bearer ${signToken()}` } });
        expect(res.statusCode).toBe(200);
        expect(mockAuditLogService.getLogs).toHaveBeenCalledWith(
            "p-1",
            expect.objectContaining({ page: 3, limit: 10 })
        );
    });

    it("I-AL-05: GET /:id — log belongs to project → 200", async () => {
        mockAuditLogService.getLogById.mockResolvedValue({ id: "log-1", entityType: "Flag", metadata: { projectId: "p-1" } });
        const res = await app.inject({ method: "GET", url: "/api/projects/p-1/audit-logs/log-1", headers: { authorization: `Bearer ${signToken()}` } });
        expect(res.statusCode).toBe(200);
    });

    it("I-AL-06: GET /:id — log from different project → 404 (org boundary)", async () => {
        mockAuditLogService.getLogById.mockResolvedValue(null); // service returns null for wrong project
        const res = await app.inject({ method: "GET", url: "/api/projects/p-1/audit-logs/log-other", headers: { authorization: `Bearer ${signToken()}` } });
        expect(res.statusCode).toBe(404);
    });

    it("I-AL-07: GET /:id — unknown id → 404", async () => {
        mockAuditLogService.getLogById.mockResolvedValue(null);
        const res = await app.inject({ method: "GET", url: "/api/projects/p-1/audit-logs/nonexistent", headers: { authorization: `Bearer ${signToken()}` } });
        expect(res.statusCode).toBe(404);
    });

    it("I-AL-08: GET /:id — no JWT → 401", async () => {
        const res = await app.inject({ method: "GET", url: "/api/projects/p-1/audit-logs/log-1" });
        expect(res.statusCode).toBe(401);
    });
});
