import "reflect-metadata";
// Security tests: Auth & JWT attacks (SEC-A-01..08)
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import Fastify, { FastifyInstance } from "fastify";
import * as jwt from "jsonwebtoken";
import { TEST_JWT_SECRET, signToken } from "../helpers/buildTestApp";
import { UserRole } from "../../src/entities/User";

const mockAuthService = {
    register: vi.fn(),
    login: vi.fn(),
    getUserById: vi.fn(),
};

async function buildApp() {
    process.env.JWT_SECRET = TEST_JWT_SECRET;
    const app = Fastify({ logger: false });

    // Authenticate decorator — identical to production logic
    app.decorate("authenticate", async (req: any, reply: any) => {
        const auth = req.headers.authorization;
        if (!auth ?.startsWith("Bearer ")) return reply.code(401).send({ error: "Unauthorized" });
        try {
            const payload = jwt.verify(auth.slice(7), TEST_JWT_SECRET) as any;
            req.user = { id: payload.userId, email: payload.email, organizationId: payload.organizationId, role: payload.role };
        } catch { return reply.code(401).send({ error: "Unauthorized" }); }
    });

    // Protected endpoint to test against
    app.get("/api/projects", { preHandler: [(app as any).authenticate] }, async (req: any, reply) => {
        return reply.send([]);
    });

    app.post("/api/auth/login", {}, async (req: any, reply) => {
        const { email, password } = req.body ?? {};
        if (!email || !password) return reply.code(400).send({ error: "Missing fields" });
        try {
            const result = await mockAuthService.login(email, password);
            return reply.code(200).send(result);
        } catch (err: any) { return reply.code(401).send({ error: err.message }); }
    });

    app.post("/api/auth/register", {}, async (req: any, reply) => {
        const { email, password, name, orgName } = req.body ?? {};
        if (!email || !password || !name || !orgName) return reply.code(400).send({ error: "Missing fields" });
        try {
            const result = await mockAuthService.register(email, password, name, orgName);
            return reply.code(201).send(result);
        } catch (err: any) { return reply.code(400).send({ error: err.message }); }
    });

    app.get("/api/auth/me", { preHandler: [(app as any).authenticate] }, async (req: any, reply) => {
        const result = await mockAuthService.getUserById(req.user.id);
        if (!result) return reply.code(404).send({ error: "Not found" });
        return reply.code(200).send(result);
    });

    await app.ready();
    return app;
}

describe("Security: Auth & JWT", () => {
    let app: FastifyInstance;

    beforeEach(async () => {
        vi.clearAllMocks();
        app = await buildApp();
    });

    afterEach(async () => { await app.close(); });

    it("SEC-A-01: request with no JWT to /api/* route → 401", async () => {
        const res = await app.inject({ method: "GET", url: "/api/projects" });
        expect(res.statusCode).toBe(401);
    });

    it("SEC-A-02: JWT signed with wrong secret → 401", async () => {
        const badToken = jwt.sign({ userId: "u1", organizationId: "org-1", role: UserRole.ADMIN }, "wrong-secret-here", { expiresIn: "1h" });
        const res = await app.inject({ method: "GET", url: "/api/projects", headers: { authorization: `Bearer ${badToken}` } });
        expect(res.statusCode).toBe(401);
    });

    it("SEC-A-03: JWT with tampered payload → 401 (signature invalid)", async () => {
        const token = signToken({ organizationId: "org-legit" });
        // Tamper: decode + modify + re-encode without signing
        const [header, , signature] = token.split(".");
        const tamperedPayload = Buffer.from(JSON.stringify({ userId: "u1", organizationId: "org-evil", role: UserRole.ADMIN, email: "x@y.com" })).toString("base64url");
        const tamperedToken = `${header}.${tamperedPayload}.${signature}`;
        const res = await app.inject({ method: "GET", url: "/api/projects", headers: { authorization: `Bearer ${tamperedToken}` } });
        expect(res.statusCode).toBe(401);
    });

    it("SEC-A-04: expired JWT → 401", async () => {
        const expired = jwt.sign({ userId: "u1", email: "a@b.com", organizationId: "org-1", role: UserRole.ADMIN }, TEST_JWT_SECRET, { expiresIn: "-1s" });
        const res = await app.inject({ method: "GET", url: "/api/projects", headers: { authorization: `Bearer ${expired}` } });
        expect(res.statusCode).toBe(401);
    });

    it("SEC-A-05: JWT with 'alg: none' attack → 401 (jsonwebtoken rejects)", async () => {
        // Craft a none-algorithm token manually
        const header = Buffer.from(JSON.stringify({ alg: "none", typ: "JWT" })).toString("base64url");
        const payload = Buffer.from(JSON.stringify({ userId: "u1", organizationId: "org-1", role: UserRole.ADMIN })).toString("base64url");
        const noneToken = `${header}.${payload}.`; // empty signature
        const res = await app.inject({ method: "GET", url: "/api/projects", headers: { authorization: `Bearer ${noneToken}` } });
        expect(res.statusCode).toBe(401);
    });

    it("SEC-A-06: Missing 'Bearer ' prefix → 401", async () => {
        const token = signToken();
        const res = await app.inject({ method: "GET", url: "/api/projects", headers: { authorization: token } }); // no "Bearer "
        expect(res.statusCode).toBe(401);
    });

    it("SEC-A-07: SQL injection in login email → 401, no crash, no stack trace", async () => {
        mockAuthService.login.mockRejectedValue(new Error("Invalid credentials"));
        const res = await app.inject({
            method: "POST", url: "/api/auth/login",
            payload: { email: "' OR 1=1; --", password: "any" },
        });
        expect(res.statusCode).toBe(401);
        expect(res.body).not.toContain("stack");
        expect(res.body).not.toContain("at ");
    });

    it("SEC-A-08: XSS payload in register name → 201, stored as-is (not executed)", async () => {
        mockAuthService.register.mockResolvedValue({
            token: "tok",
            user: { id: "u1", email: "a@b.com", name: "<script>alert(1)</script>", role: UserRole.ADMIN },
            organization: { id: "org-1", name: "Acme", slug: "acme" },
        });
        const res = await app.inject({
            method: "POST", url: "/api/auth/register",
            payload: { email: "a@b.com", password: "password1", name: "<script>alert(1)</script>", orgName: "Acme" },
        });
        // API returns JSON — XSS is a browser concern, not a server concern. 201 is correct.
        expect(res.statusCode).toBe(201);
        // Name should be in the response as a raw string (not HTML-encoded by the API)
        expect(res.json().user.name).toBe("<script>alert(1)</script>");
    });
});
