import "reflect-metadata";
// Integration tests: Segment routes (I-S-01..08)
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import Fastify, { FastifyInstance } from "fastify";
import * as jwt from "jsonwebtoken";
import { TEST_JWT_SECRET, signToken } from "../helpers/buildTestApp";
import { UserRole } from "../../src/entities/User";
import { requireRole } from "../../src/middleware/rbacMiddleware";
import { SegmentController } from "../../src/controllers/SegmentController";

const mockSegmentService = {
    createSegment: vi.fn(),
    listSegments: vi.fn(),
    getSegment: vi.fn(),
    updateSegment: vi.fn(),
    deleteSegment: vi.fn(),
};
const mockProjectService = { getProject: vi.fn() };

async function buildApp() {
    process.env.JWT_SECRET = TEST_JWT_SECRET;
    const app = Fastify({ logger: false });
    app.decorate("orm", { getRepository: vi.fn().mockReturnValue({}) });

    app.decorate("authenticate", async (req: any, reply: any) => {
        const auth = req.headers.authorization;
        if (!auth ?.startsWith("Bearer ")) return reply.code(401).send({ error: "Unauthorized" });
        try {
            const payload = jwt.verify(auth.slice(7), TEST_JWT_SECRET) as any;
            req.user = { id: payload.userId, email: payload.email, organizationId: payload.organizationId, role: payload.role };
        } catch { return reply.code(401).send({ error: "Unauthorized" }); }
    });

    const ctrl = new SegmentController(mockSegmentService as any, mockProjectService as any);
    const adminOrMember = requireRole([UserRole.ADMIN, UserRole.MEMBER]);
    const adminOnly = requireRole([UserRole.ADMIN]);

    app.addHook("onRequest", (app as any).authenticate);

    const base = "/api/projects/:projectId/segments";
    app.get(base, {}, ctrl.listSegments as any);
    app.post(base, { preHandler: [adminOrMember] }, ctrl.createSegment as any);
    app.get(`${base}/:segmentId`, {}, ctrl.getSegment as any);
    app.patch(`${base}/:segmentId`, { preHandler: [adminOrMember] }, ctrl.updateSegment as any);
    app.delete(`${base}/:id`, { preHandler: [adminOnly] }, ctrl.deleteSegment as any);

    await app.ready();
    return app;
}

describe("Integration: Segment Routes", () => {
    let app: FastifyInstance;

    beforeEach(async () => {
        vi.clearAllMocks();
        app = await buildApp();
    });

    afterEach(async () => { await app.close(); });

    it("I-S-01: GET list → 200, array", async () => {
        mockProjectService.getProject.mockResolvedValue({ id: "p-1" });
        mockSegmentService.listSegments.mockResolvedValue([{ id: "s-1" }]);
        const res = await app.inject({ method: "GET", url: "/api/projects/p-1/segments", headers: { authorization: `Bearer ${signToken()}` } });
        expect(res.statusCode).toBe(200);
        expect(Array.isArray(res.json())).toBe(true);
    });

    it("I-S-02: POST — ADMIN creates segment → 201", async () => {
        mockProjectService.getProject.mockResolvedValue({ id: "p-1" });
        mockSegmentService.createSegment.mockResolvedValue({ id: "s-1", name: "Beta Users" });
        const res = await app.inject({ method: "POST", url: "/api/projects/p-1/segments", headers: { authorization: `Bearer ${signToken({ role: UserRole.ADMIN })}` }, payload: { name: "Beta Users", rules: [] } });
        expect(res.statusCode).toBe(201);
    });

    it("I-S-03: POST — missing name → 400", async () => {
        mockProjectService.getProject.mockResolvedValue({ id: "p-1" });
        mockSegmentService.createSegment.mockRejectedValue(new Error("Name is required"));
        const res = await app.inject({ method: "POST", url: "/api/projects/p-1/segments", headers: { authorization: `Bearer ${signToken()}` }, payload: { rules: [] } });
        expect(res.statusCode).toBe(400);
    });

    it("I-S-04: POST — VIEWER → 403", async () => {
        const res = await app.inject({ method: "POST", url: "/api/projects/p-1/segments", headers: { authorization: `Bearer ${signToken({ role: UserRole.VIEWER })}` }, payload: { name: "Seg" } });
        expect(res.statusCode).toBe(403);
    });

    it("I-S-05: GET /:segmentId → 200", async () => {
        mockSegmentService.getSegment.mockResolvedValue({ id: "s-1", project: { id: "p-1" } });
        const res = await app.inject({ method: "GET", url: "/api/projects/p-1/segments/s-1", headers: { authorization: `Bearer ${signToken()}` } });
        expect(res.statusCode).toBe(200);
    });

    it("I-S-06: PATCH — MEMBER updates → 200", async () => {
        mockSegmentService.getSegment.mockResolvedValue({ id: "s-1", project: { id: "p-1" } });
        mockSegmentService.updateSegment.mockResolvedValue({ id: "s-1", name: "Updated" });
        const res = await app.inject({ method: "PATCH", url: "/api/projects/p-1/segments/s-1", headers: { authorization: `Bearer ${signToken({ role: UserRole.MEMBER })}` }, payload: { name: "Updated" } });
        expect(res.statusCode).toBe(200);
    });

    it("I-S-07: DELETE — ADMIN → 204", async () => {
        mockSegmentService.deleteSegment.mockResolvedValue(true);
        const res = await app.inject({ method: "DELETE", url: "/api/projects/p-1/segments/s-1", headers: { authorization: `Bearer ${signToken({ role: UserRole.ADMIN })}` } });
        expect(res.statusCode).toBe(204);
    });

    it("I-S-08: POST — projectId in different org → 404", async () => {
        mockProjectService.getProject.mockResolvedValue(null);
        const res = await app.inject({ method: "POST", url: "/api/projects/p-other/segments", headers: { authorization: `Bearer ${signToken()}` }, payload: { name: "Seg" } });
        expect(res.statusCode).toBe(404);
    });
});
