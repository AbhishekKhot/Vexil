import "reflect-metadata";
// Integration tests: Flag routes (I-F-01..12)
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import Fastify, { FastifyInstance } from "fastify";
import * as jwt from "jsonwebtoken";
import { TEST_JWT_SECRET, TEST_ORG_ID, signToken } from "../helpers/buildTestApp";
import { UserRole } from "../../src/entities/User";
import { requireRole } from "../../src/middleware/rbacMiddleware";
import { FlagController } from "../../src/controllers/FlagController";

const mockFlagService = {
    createFlag: vi.fn(),
    listFlags: vi.fn(),
    getFlag: vi.fn(),
    updateFlag: vi.fn(),
    deleteFlag: vi.fn(),
};

const mockProjectService = {
    getProject: vi.fn(),
};

vi.mock("../../src/services/FlagService", () => ({
    FlagService: vi.fn().mockImplementation(() => mockFlagService),
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

    const ctrl = new FlagController(mockFlagService as any, mockProjectService as any);
    const adminOnly = requireRole([UserRole.ADMIN]);
    const adminOrMember = requireRole([UserRole.ADMIN, UserRole.MEMBER]);
    const notViewer = requireRole([UserRole.ADMIN, UserRole.MEMBER]);

    app.addHook("onRequest", (app as any).authenticate);

    const base = "/api/projects/:projectId/flags";
    app.post(base, { preHandler: [adminOrMember] }, ctrl.createFlag as any);
    app.get(base, {}, ctrl.listFlags as any);
    app.get(`${base}/:flagId`, {}, ctrl.getFlag as any);
    app.put(`${base}/:flagId`, { preHandler: [notViewer] }, ctrl.updateFlag as any);
    app.delete(`${base}/:id`, { preHandler: [adminOnly] }, ctrl.deleteFlag as any);

    await app.ready();
    return app;
}

describe("Integration: Flag Routes", () => {
    let app: FastifyInstance;

    beforeEach(async () => {
        vi.clearAllMocks();
        app = await buildApp();
    });

    afterEach(async () => { await app.close(); });

    it("I-F-01: POST — ADMIN creates flag → 201", async () => {
        mockProjectService.getProject.mockResolvedValue({ id: "p-1" });
        mockFlagService.createFlag.mockResolvedValue({ id: "f-1", key: "my-flag", type: "release" });
        const res = await app.inject({ method: "POST", url: "/api/projects/p-1/flags", headers: { authorization: `Bearer ${signToken({ role: UserRole.ADMIN })}` }, payload: { key: "my-flag", type: "release" } });
        expect(res.statusCode).toBe(201);
    });

    it("I-F-02: POST — invalid key (uppercase) → 400", async () => {
        mockProjectService.getProject.mockResolvedValue({ id: "p-1" });
        mockFlagService.createFlag.mockRejectedValue(new Error("Flag key must be lowercase"));
        const res = await app.inject({ method: "POST", url: "/api/projects/p-1/flags", headers: { authorization: `Bearer ${signToken()}` }, payload: { key: "UPPERCASE-FLAG" } });
        expect(res.statusCode).toBe(400);
    });

    it("I-F-03: POST — key < 3 chars → 400", async () => {
        mockProjectService.getProject.mockResolvedValue({ id: "p-1" });
        mockFlagService.createFlag.mockRejectedValue(new Error("Key too short"));
        const res = await app.inject({ method: "POST", url: "/api/projects/p-1/flags", headers: { authorization: `Bearer ${signToken()}` }, payload: { key: "ab" } });
        expect(res.statusCode).toBe(400);
    });

    it("I-F-04: POST — invalid type → 400", async () => {
        mockProjectService.getProject.mockResolvedValue({ id: "p-1" });
        mockFlagService.createFlag.mockRejectedValue(new Error("Invalid flag type"));
        const res = await app.inject({ method: "POST", url: "/api/projects/p-1/flags", headers: { authorization: `Bearer ${signToken()}` }, payload: { key: "my-flag", type: "nonexistent" } });
        expect(res.statusCode).toBe(400);
    });

    it("I-F-05: POST — projectId in different org → 404", async () => {
        mockProjectService.getProject.mockResolvedValue(null);
        const res = await app.inject({ method: "POST", url: "/api/projects/p-other/flags", headers: { authorization: `Bearer ${signToken()}` }, payload: { key: "my-flag" } });
        expect(res.statusCode).toBe(404);
    });

    it("I-F-06: GET list → 200, array of flags", async () => {
        mockProjectService.getProject.mockResolvedValue({ id: "p-1" });
        mockFlagService.listFlags.mockResolvedValue([{ id: "f-1" }, { id: "f-2" }]);
        const res = await app.inject({ method: "GET", url: "/api/projects/p-1/flags", headers: { authorization: `Bearer ${signToken()}` } });
        expect(res.statusCode).toBe(200);
        expect(Array.isArray(res.json())).toBe(true);
    });

    it("I-F-07: GET /:flagId — flag in correct project → 200", async () => {
        mockFlagService.getFlag.mockResolvedValue({ id: "f-1", key: "my-flag", project: { id: "p-1" } });
        const res = await app.inject({ method: "GET", url: "/api/projects/p-1/flags/f-1", headers: { authorization: `Bearer ${signToken()}` } });
        expect(res.statusCode).toBe(200);
    });

    it("I-F-08: GET /:flagId — flag in different project → 404", async () => {
        mockFlagService.getFlag.mockResolvedValue({ id: "f-1", project: { id: "p-other" } });
        const res = await app.inject({ method: "GET", url: "/api/projects/p-1/flags/f-1", headers: { authorization: `Bearer ${signToken()}` } });
        expect(res.statusCode).toBe(404);
    });

    it("I-F-09: PUT — MEMBER updates flag → 200", async () => {
        mockFlagService.getFlag.mockResolvedValue({ id: "f-1", project: { id: "p-1" } });
        mockFlagService.updateFlag.mockResolvedValue({ id: "f-1", description: "updated" });
        const res = await app.inject({ method: "PUT", url: "/api/projects/p-1/flags/f-1", headers: { authorization: `Bearer ${signToken({ role: UserRole.MEMBER })}` }, payload: { description: "updated" } });
        expect(res.statusCode).toBe(200);
    });

    it("I-F-10: PUT — VIEWER → 403", async () => {
        const res = await app.inject({ method: "PUT", url: "/api/projects/p-1/flags/f-1", headers: { authorization: `Bearer ${signToken({ role: UserRole.VIEWER })}` }, payload: { description: "x" } });
        expect(res.statusCode).toBe(403);
    });

    it("I-F-11: DELETE — ADMIN, flag belongs to project → 204", async () => {
        mockFlagService.getFlag.mockResolvedValue({ id: "f-1", project: { id: "p-1" } });
        mockFlagService.deleteFlag.mockResolvedValue(true);
        const res = await app.inject({ method: "DELETE", url: "/api/projects/p-1/flags/f-1", headers: { authorization: `Bearer ${signToken({ role: UserRole.ADMIN })}` } });
        expect(res.statusCode).toBe(204);
    });

    it("I-F-12: DELETE — flagId from different project → 404", async () => {
        mockFlagService.getFlag.mockResolvedValue({ id: "f-1", project: { id: "p-other" } });
        const res = await app.inject({ method: "DELETE", url: "/api/projects/p-1/flags/f-1", headers: { authorization: `Bearer ${signToken({ role: UserRole.ADMIN })}` } });
        expect(res.statusCode).toBe(404);
    });
});
