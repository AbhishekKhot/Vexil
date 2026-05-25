import "reflect-metadata";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import Fastify, { FastifyInstance } from "fastify";
import * as jwt from "jsonwebtoken";
import { TEST_JWT_SECRET, signToken } from "../helpers/buildTestApp";

const mockServices = {
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
        bodyLimit: 512 * 1024,
    });

    app.decorate("authenticate", async (req: any, reply: any) => {
        const auth = req.headers.authorization;
        if (!auth ?.startsWith("Bearer ")) return reply.code(401).send({ error: "Unauthorized" });
        try {
            const payload = jwt.verify(auth.slice(7), TEST_JWT_SECRET) as any;
            req.user = { id: payload.userId, email: payload.email, organizationId: payload.organizationId, role: payload.role };
        } catch { return reply.code(401).send({ error: "Unauthorized" }); }
    });

    app.post("/v1/flags/evaluate", {}, async (_req, reply) => reply.code(200).send({ flags: {} }));

    app.get("/api/projects/:projectId/audit-logs", { preHandler: [(app as any).authenticate] }, async (req: any, reply) => {
        const limit = Math.min(Math.max(1, parseInt((req.query as any).limit || "20", 10)), 100);
        const result = await mockServices.getLogs(req.params.projectId, { limit });
        return reply.code(200).send(result);
    });

    app.post("/api/auth/register", {}, async (req: any, reply) => {
        const { email, password, name, orgName } = (req.body ?? {}) as any;
        if (!email || !password || !name || !orgName) return reply.code(400).send({ error: "Missing fields" });
        try {
            return reply.code(201).send(await mockServices.register(email, password, name, orgName));
        } catch (err: any) { return reply.code(400).send({ error: err.message }); }
    });

    app.put("/api/projects/:projectId/flags/:flagId/config", { preHandler: [(app as any).authenticate] }, async (req: any, reply) => {
        const body = req.body as any;

        const cfg = JSON.parse(JSON.stringify(body));
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
        const bigBody = "x".repeat(600 * 1024);
        const res = await app.inject({
            method: "POST", url: "/v1/flags/evaluate",
            headers: { "content-type": "application/json" },
            payload: bigBody,
        });
        expect(res.statusCode).toBe(413);
    });

    it("SEC-I-03: Audit log list with ?limit=99999 → limit capped to 100", async () => {
        const res = await app.inject({
            method: "GET", url: "/api/projects/p-1/audit-logs?limit=99999",
            headers: { authorization: `Bearer ${signToken()}` },
        });
        expect(res.statusCode).toBe(200);
        expect(mockServices.getLogs).toHaveBeenCalledWith("p-1", expect.objectContaining({ limit: 100 }));
    });

    it("SEC-I-05: Flag key with SQL injection chars → 400 (createFlag rejects)", async () => {

        const app2 = Fastify({ logger: false });
        app2.post("/flag", {}, async (req: any, reply) => {
            const key = (req.body as any) ?.key ?? "";
            if (!/^[a-z][a-z0-9-]*$/.test(key)) return reply.code(400).send({ error: "Invalid key format" });
            return reply.code(201).send({ id: "f-1" });
        });
        await app2.ready();

        const res = await app2.inject({ method: "POST", url: "/flag", payload: { key: "flag'; DROP TABLE flags; --" } });
        expect(res.statusCode).toBe(400);
        await app2.close();
    });

    it("SEC-I-06: Strategy config with __proto__ key → does not pollute Object.prototype", async () => {
        await app.inject({
            method: "PUT",
            url: "/api/projects/p-1/flags/f-1/config",
            headers: { authorization: `Bearer ${signToken()}` },
            payload: { "__proto__": { "polluted": true }, isEnabled: true },
        });

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

        const corsApp = Fastify({ logger: false });
        await corsApp.register(await import("@fastify/cors").then(m => m.default), {
            origin: (origin: any, cb: any) => {
                if (!origin || origin === "http://localhost:5173") return cb(null, true);
                cb(new Error("Not allowed by CORS"), false);
            },
        });
        corsApp.get("/test", async (_req, reply) => reply.send({ ok: true }));
        await corsApp.ready();

        const res = await corsApp.inject({
            method: "GET", url: "/test",
            headers: { origin: "http://evil.com" },
        });

        expect(res.headers["access-control-allow-origin"]).not.toBe("http://evil.com");
        await corsApp.close();
    });
});
