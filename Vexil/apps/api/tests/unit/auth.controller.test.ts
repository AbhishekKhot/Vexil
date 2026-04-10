import "reflect-metadata";
// Unit tests: AuthController
import { describe, it, expect, vi, beforeEach } from "vitest";
import { AuthController } from "../../src/controllers/AuthController";

// Minimal Fastify-like request/reply stubs
function makeReply() {
    const reply: any = { _code: 200, _body: undefined };
    reply.code = vi.fn((n: number) => { reply._code = n; return reply; });
    reply.send = vi.fn((body: any) => { reply._body = body; return reply; });
    return reply;
}

function makeRequest(body: any = {}, user: any = { id: "u-1" }) {
    return { body, user } as any;
}

describe("AuthController", () => {
    let authService: any;
    let ctrl: AuthController;

    beforeEach(() => {
        authService = {
            register: vi.fn(),
            login: vi.fn(),
            getUserById: vi.fn(),
        };
        ctrl = new AuthController(authService);
    });

    // --- register ---

    it("U-AC-01: register — all fields present → calls service and returns 201", async () => {
        authService.register.mockResolvedValue({ token: "tok", user: { id: "u-1" }, organization: { id: "o-1" } });
        const req = makeRequest({ email: "a@b.com", password: "pass1", name: "A", orgName: "Acme" });
        const reply = makeReply();

        await ctrl.register(req, reply);

        expect(reply.code).toHaveBeenCalledWith(201);
        expect(authService.register).toHaveBeenCalledWith("a@b.com", "pass1", "A", "Acme");
    });

    it("U-AC-02: register — missing email → 400, service not called", async () => {
        const req = makeRequest({ password: "pass1", name: "A", orgName: "Acme" });
        const reply = makeReply();

        await ctrl.register(req, reply);

        expect(reply.code).toHaveBeenCalledWith(400);
        expect(authService.register).not.toHaveBeenCalled();
    });

    it("U-AC-03: register — missing password → 400", async () => {
        const req = makeRequest({ email: "a@b.com", name: "A", orgName: "Acme" });
        const reply = makeReply();

        await ctrl.register(req, reply);

        expect(reply.code).toHaveBeenCalledWith(400);
    });

    it("U-AC-04: register — service throws → 400 with error message", async () => {
        authService.register.mockRejectedValue(new Error("Email already in use"));
        const req = makeRequest({ email: "a@b.com", password: "pass1", name: "A", orgName: "Acme" });
        const reply = makeReply();

        await ctrl.register(req, reply);

        expect(reply.code).toHaveBeenCalledWith(400);
        expect(reply.send).toHaveBeenCalledWith(expect.objectContaining({ error: "Email already in use" }));
    });

    // --- login ---

    it("U-AC-05: login — valid credentials → calls service and returns 200", async () => {
        authService.login.mockResolvedValue({ token: "tok", user: { id: "u-1" } });
        const req = makeRequest({ email: "a@b.com", password: "pass1" });
        const reply = makeReply();

        await ctrl.login(req, reply);

        expect(reply.code).toHaveBeenCalledWith(200);
        expect(authService.login).toHaveBeenCalledWith("a@b.com", "pass1");
    });

    it("U-AC-06: login — missing email → 400, service not called", async () => {
        const req = makeRequest({ password: "pass1" });
        const reply = makeReply();

        await ctrl.login(req, reply);

        expect(reply.code).toHaveBeenCalledWith(400);
        expect(authService.login).not.toHaveBeenCalled();
    });

    it("U-AC-07: login — wrong credentials (service throws) → 401", async () => {
        authService.login.mockRejectedValue(new Error("Invalid credentials"));
        const req = makeRequest({ email: "a@b.com", password: "wrong" });
        const reply = makeReply();

        await ctrl.login(req, reply);

        expect(reply.code).toHaveBeenCalledWith(401);
        expect(reply.send).toHaveBeenCalledWith(expect.objectContaining({ error: "Invalid credentials" }));
    });

    // --- me ---

    it("U-AC-08: me — user found → returns 200 with user data", async () => {
        authService.getUserById.mockResolvedValue({ id: "u-1", email: "a@b.com" });
        const req = makeRequest({}, { id: "u-1" });
        const reply = makeReply();

        await ctrl.me(req, reply);

        expect(reply.code).toHaveBeenCalledWith(200);
        expect(authService.getUserById).toHaveBeenCalledWith("u-1");
    });

    it("U-AC-09: me — user not found → 404", async () => {
        authService.getUserById.mockResolvedValue(null);
        const req = makeRequest({}, { id: "u-missing" });
        const reply = makeReply();

        await ctrl.me(req, reply);

        expect(reply.code).toHaveBeenCalledWith(404);
    });

    it("U-AC-10: me — service throws unexpectedly → 500", async () => {
        authService.getUserById.mockRejectedValue(new Error("DB error"));
        const req = makeRequest({}, { id: "u-1" });
        const reply = makeReply();

        await ctrl.me(req, reply);

        expect(reply.code).toHaveBeenCalledWith(500);
        expect(reply.send).toHaveBeenCalledWith({ error: "Internal Server Error" });
    });
});
