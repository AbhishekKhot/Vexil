import "reflect-metadata";
// Integration tests: Analytics routes (I-AN-01..10)
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import Fastify, { FastifyInstance } from "fastify";
import * as jwt from "jsonwebtoken";
import { TEST_JWT_SECRET, signToken } from "../helpers/buildTestApp";
import { UserRole } from "../../src/entities/User";
import { AnalyticsController } from "../../src/controllers/AnalyticsController";

const mockAnalyticsService = {
    ingestEvents: vi.fn(),
    getAnalytics: vi.fn(),
};

async function buildApp() {
    process.env.JWT_SECRET = TEST_JWT_SECRET;
    const app = Fastify({ logger: false });

    app.decorate("authenticate", async (req: any, reply: any) => {
        const auth = req.headers.authorization;
        if (!auth?.startsWith("Bearer ")) return reply.code(401).send({ error: "Unauthorized" });
        // Distinguish between API key (vex_) and JWT
        if (auth.startsWith("Bearer vex_")) {
            req.user = { id: "u1", organizationId: "org-1", role: UserRole.ADMIN };
            return;
        }
        try {
            const payload = jwt.verify(auth.slice(7), TEST_JWT_SECRET) as any;
            req.user = { id: payload.userId, email: payload.email, organizationId: payload.organizationId, role: payload.role };
        } catch { return reply.code(401).send({ error: "Unauthorized" }); }
    });

    const ctrl = new AnalyticsController(mockAnalyticsService as any);

    // Data plane (API key)
    app.post("/v1/events", {}, ctrl.ingest as any);

    // Control plane (JWT)
    app.get("/api/projects/:projectId/stats", { preHandler: [(app as any).authenticate] }, ctrl.getAnalytics as any);

    await app.ready();
    return app;
}

describe("Integration: Analytics Routes", () => {
    let app: FastifyInstance;

    beforeEach(async () => {
        vi.clearAllMocks();
        app = await buildApp();
    });

    afterEach(async () => { await app.close(); });

    it("I-AN-01: POST /v1/events — valid batch → 202", async () => {
        mockAnalyticsService.ingestEvents.mockResolvedValue(true);
        const res = await app.inject({ method: "POST", url: "/v1/events", headers: { authorization: "Bearer vex_validkey" }, payload: [{ flagKey: "f", result: true }] });
        expect(res.statusCode).toBe(202);
    });

    it("I-AN-02: POST /v1/events — no auth header → 401", async () => {
        const res = await app.inject({ method: "POST", url: "/v1/events", payload: [{ flagKey: "f", result: true }] });
        expect(res.statusCode).toBe(401);
    });

    it("I-AN-03: POST /v1/events — 501 events → 400", async () => {
        mockAnalyticsService.ingestEvents.mockRejectedValue(new Error("Batch too large. Maximum 500 events per request."));
        const events = Array.from({ length: 501 }, (_, i) => ({ flagKey: `f-${i}`, result: true }));
        const res = await app.inject({ method: "POST", url: "/v1/events", headers: { authorization: "Bearer vex_key" }, payload: events });
        expect(res.statusCode).toBe(400);
    });

    it("I-AN-04: POST /v1/events — missing flagKey → 400", async () => {
        mockAnalyticsService.ingestEvents.mockRejectedValue(new Error("Each event must have a non-empty flagKey string."));
        const res = await app.inject({ method: "POST", url: "/v1/events", headers: { authorization: "Bearer vex_key" }, payload: [{ result: true }] });
        expect(res.statusCode).toBe(400);
    });

    it("I-AN-05: POST /v1/events — result not boolean → 400", async () => {
        mockAnalyticsService.ingestEvents.mockRejectedValue(new Error("Each event result must be a boolean."));
        const res = await app.inject({ method: "POST", url: "/v1/events", headers: { authorization: "Bearer vex_key" }, payload: [{ flagKey: "f", result: "yes" }] });
        expect(res.statusCode).toBe(400);
    });

    it("I-AN-06: GET /stats — ADMIN with valid projectId → 200, stats array", async () => {
        mockAnalyticsService.getAnalytics.mockResolvedValue([{ flagKey: "f", evaluations: 10, enabled: 7, disabled: 3, passRate: 70 }]);
        const res = await app.inject({ method: "GET", url: "/api/projects/p-1/stats", headers: { authorization: `Bearer ${signToken({ role: UserRole.ADMIN })}` } });
        expect(res.statusCode).toBe(200);
        expect(Array.isArray(res.json())).toBe(true);
    });

    it("I-AN-07: GET /stats — projectId from different org → 200 but empty array", async () => {
        mockAnalyticsService.getAnalytics.mockResolvedValue([]); // service returns [] for org mismatch
        const res = await app.inject({ method: "GET", url: "/api/projects/p-other/stats", headers: { authorization: `Bearer ${signToken()}` } });
        expect(res.statusCode).toBe(200);
        expect(res.json()).toEqual([]);
    });

    it("I-AN-08: GET /stats — VIEWER role → 200 (read allowed)", async () => {
        mockAnalyticsService.getAnalytics.mockResolvedValue([]);
        const res = await app.inject({ method: "GET", url: "/api/projects/p-1/stats", headers: { authorization: `Bearer ${signToken({ role: UserRole.VIEWER })}` } });
        expect(res.statusCode).toBe(200);
    });

    it("I-AN-09: GET /stats — no JWT → 401", async () => {
        const res = await app.inject({ method: "GET", url: "/api/projects/p-1/stats" });
        expect(res.statusCode).toBe(401);
    });

    it("I-AN-10: GET /stats — with environmentId filter → 200", async () => {
        mockAnalyticsService.getAnalytics.mockResolvedValue([]);
        const res = await app.inject({ method: "GET", url: "/api/projects/p-1/stats?environmentId=env-1", headers: { authorization: `Bearer ${signToken()}` } });
        expect(res.statusCode).toBe(200);
        expect(mockAnalyticsService.getAnalytics).toHaveBeenCalledWith(expect.any(String), expect.any(String), "env-1", undefined);
    });
});
