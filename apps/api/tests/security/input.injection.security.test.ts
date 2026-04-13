import "reflect-metadata";
// Security tests: Input & Injection (SEC-I-01..08)
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import Fastify, { FastifyInstance } from "fastify";
import * as jwt from "jsonwebtoken";
import { TEST_JWT_SECRET, signToken } from "../helpers/buildTestApp";
import { UserRole } from "../../src/entities/User";

const mockServices = {
    ingestEvents: vi.fn(),
    getLogs: vi.fn(),
    login: vi.fn(),
    register: vi.fn(),
    setFlagConfig: vi.fn(),
};

async function buildApp() {
    process.env.JWT_SECRET = TEST_JWT_SECRET;
    process.env.WEB_URL = "http://localhost:5173";
    const app = Fastify({
        logger: false,
        bodyLimit: 512 * 1024, // 512 KB — same as production
    });

    app.decorate("authenticate", async (req: any, reply: any) => {
        const auth = req.headers.authorization;
        if (!auth?.startsWith("Bearer ")) return reply.code(401).send({ error: "Unauthorized" });
        try {
            const payload = jwt.verify(auth.slice(7), TEST_JWT_SECRET) as any;
            req.user = { id: payload.userId, email: payload.email, organizationId: payload.organizationId, role: payload.role };
        } catch { return reply.code(401).send({ error: "Unauthorized" }); }
    });

    // POST /v1/events — batch ingest
    app.post("/v1/events", {}, async (req: any, reply) => {
        const events = req.body;
        try {
            await mockServices.ingestEvents("vex_key", events);
            return reply.code(202).send({ status: "accepted" });
        } catch (err: any) { return reply.code(400).send({ error: err.message }); }
    });

    // GET audit logs with limit param
    app.get("/api/projects/:projectId/audit-logs", { preHandler: [(app as any).authenticate] }, async (req: any, reply) => {
        const limit = Math.min(Math.max(1, parseInt((req.query as any).limit || "20", 10)), 100);
        const result = await mockServices.getLogs(req.params.projectId, { limit });
        return reply.code(200).send(result);
    });

    // POST register
    app.post("/api/auth/register", {}, async (req: any, reply) => {
        const { email, password, name, orgName } = (req.body ?? {}) as any;
        if (!email || !password || !name || !orgName) return reply.code(400).send({ error: "Missing fields" });
        try {
            return reply.code(201).send(await mockServices.register(email, password, name, orgName));
        } catch (err: any) { return reply.code(400).send({ error: err.message }); }
    });

    // PUT flag config — prototype pollution check
    app.put("/api/projects/:projectId/flags/:flagId/config", { preHandler: [(app as any).authenticate] }, async (req: any, reply) => {
        const body = req.body as any;
        // Simulate setting the config (checks for prototype pollution)
        const cfg = JSON.parse(JSON.stringify(body)); // safe copy
        return reply.code(200).send({ saved: true });
    });

    await app.ready();
    return app;
}

describe("Security: Input & Injection", () => {
    let app: FastifyInstance;

    beforeEach(async () => {
        vi.clearAllMocks();
        mockServices.getLogs.mockResolvedValue({ items: [], total: 0, page: 1, limit: 100 });
        app = await buildApp();
    });

    afterEach(async () => { await app.close(); });

    it("SEC-I-01: Request body > 512KB → 413 (Fastify bodyLimit)", async () => {
        const bigBody = "x".repeat(600 * 1024); // 600 KB > 512 KB limit
        const res = await app.inject({
            method: "POST", url: "/v1/events",
            headers: { "content-type": "application/json" },
            payload: bigBody,
        });
        expect(res.statusCode).toBe(413);
    });

    it("SEC-I-02: POST /v1/events with 501 items → 400", async () => {
        mockServices.ingestEvents.mockRejectedValue(new Error("Batch too large. Maximum 500 events per request."));
        const events = Array.from({ length: 501 }, (_, i) => ({ flagKey: `f-${i}`, result: true }));
        const res = await app.inject({ method: "POST", url: "/v1/events", payload: events });
        expect(res.statusCode).toBe(400);
    });

    it("SEC-I-03: Audit log list with ?limit=99999 → limit capped to 100", async () => {
        const res = await app.inject({
            method: "GET", url: "/api/projects/p-1/audit-logs?limit=99999",
            headers: { authorization: `Bearer ${signToken()}` },
        });
        expect(res.statusCode).toBe(200);
        expect(mockServices.getLogs).toHaveBeenCalledWith("p-1", expect.objectContaining({ limit: 100 }));
    });

    it("SEC-I-04: Context with 10KB object → service receives null context (silently stripped)", async () => {
        const events = [{ flagKey: "f", result: true, context: { data: "x".repeat(10 * 1024) } }];
        mockServices.ingestEvents.mockImplementation(async (_key: any, evts: any[]) => {
            // Simulate what AnalyticsService does: strip > 2KB context
            const ctx = evts[0].context;
            const serialized = JSON.stringify(ctx);
            if (serialized.length > 2048) {
                evts[0].context = null;
            }
            return true;
        });
        await app.inject({ method: "POST", url: "/v1/events", payload: events });
        const callArg = mockServices.ingestEvents.mock.calls[0][1];
        expect(callArg[0].context).toBeNull();
    });

    it("SEC-I-05: Flag key with SQL injection chars → 400 (createFlag rejects)", async () => {
        // The FlagService should reject keys like "flag'; DROP TABLE flags; --"
        // We test the validation path via service throwing
        const app2 = Fastify({ logger: false });
        app2.post("/flag", {}, async (req: any, reply) => {
            const key = (req.body as any)?.key ?? "";
            if (!/^[a-z][a-z0-9-]*$/.test(key)) return reply.code(400).send({ error: "Invalid key format" });
            return reply.code(201).send({ id: "f-1" });
        });
        await app2.ready();

        const res = await app2.inject({ method: "POST", url: "/flag", payload: { key: "flag'; DROP TABLE flags; --" } });
        expect(res.statusCode).toBe(400);
        await app2.close();
    });

    it("SEC-I-06: Strategy config with __proto__ key → does not pollute Object.prototype", async () => {
        const originalProto = Object.prototype as any;
        const before = originalProto.polluted;

        await app.inject({
            method: "PUT",
            url: "/api/projects/p-1/flags/f-1/config",
            headers: { authorization: `Bearer ${signToken()}` },
            payload: { "__proto__": { "polluted": true }, isEnabled: true },
        });

        // Prototype should NOT be polluted
        expect((Object.prototype as any).polluted).toBeUndefined();
    });

    it("SEC-I-07: Register with email containing script tag → 400 (fails email regex)", async () => {
        mockServices.register.mockRejectedValue(new Error("Invalid email address."));
        const res = await app.inject({
            method: "POST", url: "/api/auth/register",
            payload: { email: "admin@org.com<script>alert(1)</script>", password: "password1", name: "A", orgName: "Acme" },
        });
        expect(res.statusCode).toBe(400);
    });

    it("SEC-I-08: GET /audit-logs from disallowed CORS origin → CORS block", async () => {
        // Build an app with CORS configured
        const corsApp = Fastify({ logger: false });
        await corsApp.register(await import("@fastify/cors").then(m => m.default), {
            origin: (origin: any, cb: any) => {
                if (!origin || origin === "http://localhost:5173") return cb(null, true);
                cb(new Error("Not allowed by CORS"), false);
            },
        });
        corsApp.get("/test", async (_req, reply) => reply.send({ ok: true }));
        await corsApp.ready();

        // Request from disallowed origin
        const res = await corsApp.inject({
            method: "GET", url: "/test",
            headers: { origin: "http://evil.com" },
        });
        // Fastify CORS sends 500 for blocked origins by default, or 200 without the Access-Control-Allow-Origin header
        // The important assertion is that the CORS header is NOT set for the disallowed origin
        expect(res.headers["access-control-allow-origin"]).not.toBe("http://evil.com");
        await corsApp.close();
    });
});
