// Integration tests: Auth routes (I-A-01..14)
import "reflect-metadata";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import Fastify, { FastifyInstance } from "fastify";
import * as jwt from "jsonwebtoken";
import { TEST_JWT_SECRET, signToken } from "../helpers/buildTestApp";
import { UserRole } from "../../src/entities/User";

function buildAuthServiceMock() {
    return {
        register: vi.fn(),
        login: vi.fn(),
        getUserById: vi.fn(),
    };
}

async function buildApp(authService: ReturnType<typeof buildAuthServiceMock>) {
    process.env.JWT_SECRET = TEST_JWT_SECRET;
    const app = Fastify({ logger: false });

    // Stub authenticate decorator
    app.decorate("authenticate", async (req: any, reply: any) => {
        const auth = req.headers.authorization;
        if (!auth ?.startsWith("Bearer ")) return reply.code(401).send({ error: "Unauthorized" });
        try {
            const payload = jwt.verify(auth.slice(7), TEST_JWT_SECRET) as any;
            req.user = { id: payload.userId, email: payload.email, organizationId: payload.organizationId, role: payload.role };
        } catch {
            return reply.code(401).send({ error: "Unauthorized" });
        }
    });

    app.post("/api/auth/register", async (req: any, reply) => {
        const { email, password, name, orgName } = req.body ?? {};
        if (!email || !password || !name || !orgName) return reply.code(400).send({ error: "Missing required fields" });
        try {
            const result = await authService.register(email, password, name, orgName);
            return reply.code(201).send(result);
        } catch (err: any) { return reply.code(400).send({ error: err.message }); }
    });

    app.post("/api/auth/login", async (req: any, reply) => {
        const { email, password } = req.body ?? {};
        if (!email || !password) return reply.code(400).send({ error: "Email and password are required" });
        try {
            const result = await authService.login(email, password);
            return reply.code(200).send(result);
        } catch (err: any) { return reply.code(401).send({ error: err.message }); }
    });

    app.get("/api/auth/me", { preHandler: [(app as any).authenticate] }, async (req: any, reply) => {
        try {
            const result = await authService.getUserById(req.user.id);
            if (!result) return reply.code(404).send({ error: "User not found" });
            return reply.code(200).send(result);
        } catch { return reply.code(500).send({ error: "Internal Server Error" }); }
    });

    await app.ready();
    return app;
}

describe("Integration: Auth Routes", () => {
    let app: FastifyInstance;
    let authService: ReturnType<typeof buildAuthServiceMock>;

    beforeEach(async () => {
        authService = buildAuthServiceMock();
        app = await buildApp(authService);
    });

    afterEach(async () => { await app.close(); });

    it("I-A-01: POST /register — valid body → 201, returns token + user + org", async () => {
        authService.register.mockResolvedValue({
            token: "tok", user: { id: "u1", email: "a@b.com", name: "Alice", role: UserRole.ADMIN },
            organization: { id: "org-1", name: "Acme", slug: "acme" },
        });
        const res = await app.inject({ method: "POST", url: "/api/auth/register", payload: { email: "a@b.com", password: "password1", name: "Alice", orgName: "Acme" } });
        expect(res.statusCode).toBe(201);
        const body = res.json();
        expect(body.token).toBeDefined();
        expect(body.user).toBeDefined();
    });

    it("I-A-02: POST /register — missing email → 400", async () => {
        const res = await app.inject({ method: "POST", url: "/api/auth/register", payload: { password: "password1", name: "Alice", orgName: "Acme" } });
        expect(res.statusCode).toBe(400);
    });

    it("I-A-03: POST /register — missing password → 400", async () => {
        const res = await app.inject({ method: "POST", url: "/api/auth/register", payload: { email: "a@b.com", name: "Alice", orgName: "Acme" } });
        expect(res.statusCode).toBe(400);
    });

    it("I-A-04: POST /register — invalid email format → 400", async () => {
        authService.register.mockRejectedValue(new Error("Invalid email address."));
        const res = await app.inject({ method: "POST", url: "/api/auth/register", payload: { email: "notanemail", password: "password1", name: "Alice", orgName: "Acme" } });
        expect(res.statusCode).toBe(400);
        expect(res.json().error).toContain("Invalid email");
    });

    it("I-A-05: POST /register — password < 8 chars → 400", async () => {
        authService.register.mockRejectedValue(new Error("Password must be at least 8 characters."));
        const res = await app.inject({ method: "POST", url: "/api/auth/register", payload: { email: "a@b.com", password: "short", name: "Alice", orgName: "Acme" } });
        expect(res.statusCode).toBe(400);
    });

    it("I-A-06: POST /register — response NEVER contains passwordHash", async () => {
        authService.register.mockResolvedValue({
            token: "tok", user: { id: "u1", email: "a@b.com", name: "Alice", role: UserRole.ADMIN },
            organization: { id: "org-1", name: "Acme", slug: "acme" },
        });
        const res = await app.inject({ method: "POST", url: "/api/auth/register", payload: { email: "a@b.com", password: "password1", name: "Alice", orgName: "Acme" } });
        expect(res.body).not.toContain("passwordHash");
    });

    it("I-A-07: POST /login — valid credentials → 200, token in body", async () => {
        authService.login.mockResolvedValue({
            token: "jwt-tok", user: { id: "u1", email: "a@b.com", name: "Alice", role: UserRole.ADMIN },
            organization: { id: "org-1", name: "Acme", slug: "acme" },
        });
        const res = await app.inject({ method: "POST", url: "/api/auth/login", payload: { email: "a@b.com", password: "password1" } });
        expect(res.statusCode).toBe(200);
        expect(res.json().token).toBe("jwt-tok");
    });

    it("I-A-08: POST /login — wrong password → 401", async () => {
        authService.login.mockRejectedValue(new Error("Invalid credentials"));
        const res = await app.inject({ method: "POST", url: "/api/auth/login", payload: { email: "a@b.com", password: "wrong" } });
        expect(res.statusCode).toBe(401);
    });

    it("I-A-09: POST /login — unknown email → 401", async () => {
        authService.login.mockRejectedValue(new Error("Invalid credentials"));
        const res = await app.inject({ method: "POST", url: "/api/auth/login", payload: { email: "ghost@b.com", password: "password1" } });
        expect(res.statusCode).toBe(401);
    });

    it("I-A-10: POST /login — missing body fields → 400", async () => {
        const res = await app.inject({ method: "POST", url: "/api/auth/login", payload: { email: "a@b.com" } });
        expect(res.statusCode).toBe(400);
    });

    it("I-A-11: GET /me — valid JWT → 200, returns user + org (no passwordHash)", async () => {
        authService.getUserById.mockResolvedValue({
            user: { id: "u1", email: "a@b.com", name: "Alice", role: UserRole.ADMIN },
            organization: { id: "org-1", name: "Acme", slug: "acme" },
        });
        const token = signToken();
        const res = await app.inject({ method: "GET", url: "/api/auth/me", headers: { authorization: `Bearer ${token}` } });
        expect(res.statusCode).toBe(200);
        expect(res.body).not.toContain("passwordHash");
    });

    it("I-A-12: GET /me — no Authorization header → 401", async () => {
        const res = await app.inject({ method: "GET", url: "/api/auth/me" });
        expect(res.statusCode).toBe(401);
    });

    it("I-A-13: GET /me — expired JWT → 401", async () => {
        const expired = jwt.sign({ userId: "u1", email: "a@b.com", organizationId: "org-1", role: UserRole.ADMIN }, TEST_JWT_SECRET, { expiresIn: "-1s" });
        const res = await app.inject({ method: "GET", url: "/api/auth/me", headers: { authorization: `Bearer ${expired}` } });
        expect(res.statusCode).toBe(401);
    });

    it("I-A-14: GET /me — malformed JWT → 401", async () => {
        const res = await app.inject({ method: "GET", url: "/api/auth/me", headers: { authorization: "Bearer this.is.not.a.jwt" } });
        expect(res.statusCode).toBe(401);
    });
});
