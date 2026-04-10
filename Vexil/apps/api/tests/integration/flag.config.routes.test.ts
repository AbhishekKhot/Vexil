import "reflect-metadata";
// Integration tests: Flag Config routes (I-FC-01..08)
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import Fastify, { FastifyInstance } from "fastify";
import * as jwt from "jsonwebtoken";
import { TEST_JWT_SECRET, signToken } from "../helpers/buildTestApp";
import { UserRole } from "../../src/entities/User";
import { requireRole } from "../../src/middleware/rbacMiddleware";
import { FlagConfigController } from "../../src/controllers/FlagConfigController";
import { StrategyValidationError } from "../../src/evaluation/EvaluationStrategy.interface";

const mockFlagConfigService = {
    getFlagConfig: vi.fn(),
    setFlagConfig: vi.fn(),
};
const mockFlagService   = { getFlag: vi.fn() };
const mockEnvService    = { getEnvironment: vi.fn() };

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

    const ctrl = new FlagConfigController(mockFlagConfigService as any, mockFlagService as any, mockEnvService as any);
    const notViewer = requireRole([UserRole.ADMIN, UserRole.MEMBER]);

    app.addHook("onRequest", (app as any).authenticate);

    const base = "/api/projects/:projectId/environments/:environmentId/flags/:flagId";
    app.get(base, {}, ctrl.getFlagConfig as any);
    app.put(base, { preHandler: [notViewer] }, ctrl.setFlagConfig as any);

    await app.ready();
    return app;
}

describe("Integration: Flag Config Routes", () => {
    let app: FastifyInstance;

    beforeEach(async () => {
        vi.clearAllMocks();
        app = await buildApp();
    });

    afterEach(async () => { await app.close(); });

    const url = "/api/projects/p-1/environments/e-1/flags/f-1";

    it("I-FC-01: GET — existing config → 200", async () => {
        mockFlagConfigService.getFlagConfig.mockResolvedValue({ id: "cfg-1", isEnabled: true });
        const res = await app.inject({ method: "GET", url, headers: { authorization: `Bearer ${signToken()}` } });
        expect(res.statusCode).toBe(200);
    });

    it("I-FC-02: GET — no config → 404", async () => {
        mockFlagConfigService.getFlagConfig.mockResolvedValue(null);
        const res = await app.inject({ method: "GET", url, headers: { authorization: `Bearer ${signToken()}` } });
        expect(res.statusCode).toBe(404);
    });

    it("I-FC-03: PUT — valid rollout config → 200", async () => {
        mockFlagService.getFlag.mockResolvedValue({ id: "f-1" });
        mockEnvService.getEnvironment.mockResolvedValue({ id: "e-1" });
        mockFlagConfigService.setFlagConfig.mockResolvedValue({ id: "cfg-1", isEnabled: true, strategyType: "rollout", strategyConfig: { percentage: 50, hashAttribute: "userId" } });
        const res = await app.inject({ method: "PUT", url, headers: { authorization: `Bearer ${signToken()}` }, payload: { isEnabled: true, strategyType: "rollout", strategyConfig: { percentage: 50, hashAttribute: "userId" } } });
        expect(res.statusCode).toBe(200);
        expect(res.json().strategyConfig).toBeDefined();
    });

    it("I-FC-04: PUT — invalid strategyType → 400 with validation message", async () => {
        mockFlagService.getFlag.mockResolvedValue({ id: "f-1" });
        mockEnvService.getEnvironment.mockResolvedValue({ id: "e-1" });
        mockFlagConfigService.setFlagConfig.mockRejectedValue(new StrategyValidationError("percentage must be a number between 0 and 100"));
        const res = await app.inject({ method: "PUT", url, headers: { authorization: `Bearer ${signToken()}` }, payload: { isEnabled: true, strategyType: "rollout", strategyConfig: { percentage: 999 } } });
        expect(res.statusCode).toBe(400);
        expect(res.json().error).toContain("StrategyValidation");
    });

    it("I-FC-05: PUT — ab_test without variants → 400", async () => {
        mockFlagService.getFlag.mockResolvedValue({ id: "f-1" });
        mockEnvService.getEnvironment.mockResolvedValue({ id: "e-1" });
        mockFlagConfigService.setFlagConfig.mockRejectedValue(new StrategyValidationError("variants must be a non-empty array"));
        const res = await app.inject({ method: "PUT", url, headers: { authorization: `Bearer ${signToken()}` }, payload: { isEnabled: true, strategyType: "ab_test", strategyConfig: {} } });
        expect(res.statusCode).toBe(400);
    });

    it("I-FC-06: PUT — VIEWER → 403", async () => {
        const res = await app.inject({ method: "PUT", url, headers: { authorization: `Bearer ${signToken({ role: UserRole.VIEWER })}` }, payload: { isEnabled: true } });
        expect(res.statusCode).toBe(403);
    });

    it("I-FC-07: PUT — isEnabled not boolean → 400", async () => {
        const res = await app.inject({ method: "PUT", url, headers: { authorization: `Bearer ${signToken()}` }, payload: { isEnabled: "yes" } });
        expect(res.statusCode).toBe(400);
    });

    it("I-FC-08: PUT — unknown flagId → 404", async () => {
        mockFlagService.getFlag.mockResolvedValue(null);
        mockEnvService.getEnvironment.mockResolvedValue({ id: "e-1" });
        const res = await app.inject({ method: "PUT", url, headers: { authorization: `Bearer ${signToken()}` }, payload: { isEnabled: true } });
        expect(res.statusCode).toBe(404);
    });
});
