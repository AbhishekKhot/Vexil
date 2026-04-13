// Unit tests: AuthService (U-A-01..12)
import "reflect-metadata";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { AuthService } from "../../src/services/AuthService";
import { UserRole } from "../../src/entities/User";
import * as bcrypt from "bcryptjs";
import * as jwt from "jsonwebtoken";

vi.mock("bcryptjs");
vi.mock("jsonwebtoken");

const mockBcrypt = vi.mocked(bcrypt);
const mockJwt = vi.mocked(jwt);

const makeUserRepo = () => ({
    findOne: vi.fn(),
    save: vi.fn(),
    create: vi.fn(),
});

const makeOrgRepo = () => ({
    save: vi.fn(),
    create: vi.fn(),
});

function makeService() {
    process.env.JWT_SECRET = "test-secret-32-chars-long-enough!!";
    const userRepo = makeUserRepo() as any;
    const orgRepo = makeOrgRepo() as any;
    return { service: new AuthService(userRepo, orgRepo), userRepo, orgRepo };
}

describe("AuthService.register()", () => {
    beforeEach(() => {
        vi.resetAllMocks();
        process.env.JWT_SECRET = "test-secret-32-chars-long-enough!!";
    });

    it("U-A-01: valid inputs → creates org, hashes password, returns token + safe user (no passwordHash)", async () => {
        const { service, userRepo, orgRepo } = makeService();
        const org = { id: "org-1", name: "Acme", slug: "acme" };
        const user = { id: "user-1", email: "alice@acme.com", name: "Alice", role: UserRole.ADMIN, organizationId: "org-1", organization: org };

        orgRepo.create.mockReturnValue(org);
        orgRepo.save.mockResolvedValue(org);
        userRepo.create.mockReturnValue(user);
        userRepo.save.mockResolvedValue(user);
        mockBcrypt.hash = vi.fn().mockResolvedValue("hashed-pw") as any;
        mockJwt.sign = vi.fn().mockReturnValue("jwt-token") as any;

        const result = await service.register("alice@acme.com", "password1", "Alice", "Acme");

        expect(result.token).toBe("jwt-token");
        expect(result.user).not.toHaveProperty("passwordHash");
        expect(result.user.email).toBe("alice@acme.com");
        expect(result.organization.slug).toBe("acme");
        expect(mockBcrypt.hash).toHaveBeenCalledWith("password1", 10);
    });

    it("U-A-02: invalid email (no @) → throws 'Invalid email address.'", async () => {
        const { service } = makeService();
        await expect(service.register("notanemail", "password1", "Alice", "Acme"))
            .rejects.toThrow("Invalid email address.");
    });

    it("U-A-03: invalid email (no domain) → throws", async () => {
        const { service } = makeService();
        await expect(service.register("alice@", "password1", "Alice", "Acme"))
            .rejects.toThrow("Invalid email address.");
    });

    it("U-A-04: password shorter than 8 chars → throws 'Password must be at least 8 characters.'", async () => {
        const { service } = makeService();
        await expect(service.register("alice@acme.com", "short", "Alice", "Acme"))
            .rejects.toThrow("Password must be at least 8 characters.");
    });

    it("U-A-05: password exactly 8 chars → succeeds", async () => {
        const { service, userRepo, orgRepo } = makeService();
        const org = { id: "org-1", name: "Acme", slug: "acme" };
        const user = { id: "user-1", email: "alice@acme.com", name: "Alice", role: UserRole.ADMIN, organizationId: "org-1", organization: org };
        orgRepo.create.mockReturnValue(org);
        orgRepo.save.mockResolvedValue(org);
        userRepo.create.mockReturnValue(user);
        userRepo.save.mockResolvedValue(user);
        mockBcrypt.hash = vi.fn().mockResolvedValue("hashed") as any;
        mockJwt.sign = vi.fn().mockReturnValue("tok") as any;

        await expect(service.register("alice@acme.com", "exactly8", "Alice", "Acme"))
            .resolves.toBeDefined();
    });

    it("U-A-06: orgName with spaces + special chars → slug is sanitized (lowercase, hyphens only)", async () => {
        const { service, userRepo, orgRepo } = makeService();
        const org = { id: "org-1", name: "My Org!", slug: "my-org" };
        const user = { id: "u1", email: "a@b.com", name: "A", role: UserRole.ADMIN, organizationId: "org-1", organization: org };
        orgRepo.create.mockImplementation((data: any) => ({ ...data }));
        orgRepo.save.mockResolvedValue(org);
        userRepo.create.mockReturnValue(user);
        userRepo.save.mockResolvedValue(user);
        mockBcrypt.hash = vi.fn().mockResolvedValue("h") as any;
        mockJwt.sign = vi.fn().mockReturnValue("t") as any;

        await service.register("a@b.com", "password1", "A", "My Org!");

        // slug should be "my-org" (spaces → hyphens, special chars stripped)
        expect(orgRepo.create).toHaveBeenCalledWith(expect.objectContaining({ slug: "my-org" }));
    });

    it("U-A-07: duplicate email (repo throws) → error propagates", async () => {
        const { service, userRepo, orgRepo } = makeService();
        const org = { id: "org-1", name: "Acme", slug: "acme" };
        orgRepo.create.mockReturnValue(org);
        orgRepo.save.mockResolvedValue(org);
        mockBcrypt.hash = vi.fn().mockResolvedValue("h") as any;
        userRepo.create.mockReturnValue({});
        userRepo.save.mockRejectedValue(new Error("unique constraint violation"));

        await expect(service.register("alice@acme.com", "password1", "Alice", "Acme"))
            .rejects.toThrow("unique constraint violation");
    });
});

describe("AuthService.login()", () => {
    beforeEach(() => {
        vi.resetAllMocks();
        process.env.JWT_SECRET = "test-secret-32-chars-long-enough!!";
    });

    it("U-A-08: valid credentials → returns token + safe user with 8h JWT (no passwordHash)", async () => {
        const { service, userRepo } = makeService();
        const org = { id: "org-1", name: "Acme", slug: "acme" };
        const user = { id: "u1", email: "alice@acme.com", name: "Alice", role: UserRole.ADMIN, organizationId: "org-1", passwordHash: "hashed", organization: org };
        userRepo.findOne.mockResolvedValue(user);
        mockBcrypt.compare = vi.fn().mockResolvedValue(true) as any;
        mockJwt.sign = vi.fn().mockReturnValue("jwt-8h") as any;

        const result = await service.login("alice@acme.com", "password1");

        expect(result.token).toBe("jwt-8h");
        expect(result.user).not.toHaveProperty("passwordHash");
        // Verify 8h expiry passed to jwt.sign
        expect(mockJwt.sign).toHaveBeenCalledWith(
            expect.any(Object),
            expect.any(String),
            expect.objectContaining({ expiresIn: "8h" })
        );
    });

    it("U-A-09: unknown email → throws 'Invalid credentials' (no email enumeration)", async () => {
        const { service, userRepo } = makeService();
        userRepo.findOne.mockResolvedValue(null);

        await expect(service.login("ghost@acme.com", "password1"))
            .rejects.toThrow("Invalid credentials");
    });

    it("U-A-10: wrong password → throws 'Invalid credentials'", async () => {
        const { service, userRepo } = makeService();
        const user = { id: "u1", email: "alice@acme.com", name: "Alice", role: UserRole.ADMIN, organizationId: "org-1", passwordHash: "hashed", organization: {} };
        userRepo.findOne.mockResolvedValue(user);
        mockBcrypt.compare = vi.fn().mockResolvedValue(false) as any;

        await expect(service.login("alice@acme.com", "wrongpass"))
            .rejects.toThrow("Invalid credentials");
    });

    it("U-A-11: JWT token payload contains userId, email, organizationId, role", async () => {
        const { service, userRepo } = makeService();
        const org = { id: "org-1", name: "Acme", slug: "acme" };
        const user = { id: "u1", email: "alice@acme.com", name: "Alice", role: UserRole.ADMIN, organizationId: "org-1", passwordHash: "hashed", organization: org };
        userRepo.findOne.mockResolvedValue(user);
        mockBcrypt.compare = vi.fn().mockResolvedValue(true) as any;
        mockJwt.sign = vi.fn().mockReturnValue("tok") as any;

        await service.login("alice@acme.com", "password1");

        expect(mockJwt.sign).toHaveBeenCalledWith(
            expect.objectContaining({
                userId: "u1",
                email: "alice@acme.com",
                organizationId: "org-1",
                role: UserRole.ADMIN,
            }),
            expect.any(String),
            expect.any(Object)
        );
    });
});

describe("AuthService.getUserById()", () => {
    beforeEach(() => {
        vi.resetAllMocks();
        process.env.JWT_SECRET = "test-secret-32-chars-long-enough!!";
    });

    it("U-A-12: existing user → returns SafeUser + SafeOrg (no passwordHash)", async () => {
        const { service, userRepo } = makeService();
        const org = { id: "org-1", name: "Acme", slug: "acme" };
        const user = { id: "u1", email: "alice@acme.com", name: "Alice", role: UserRole.ADMIN, organizationId: "org-1", passwordHash: "should-not-appear", organization: org };
        userRepo.findOne.mockResolvedValue(user);

        const result = await service.getUserById("u1");

        expect(result).not.toBeNull();
        expect(result!.user).toEqual({ id: "u1", email: "alice@acme.com", name: "Alice", role: UserRole.ADMIN });
        expect(result!.user).not.toHaveProperty("passwordHash");
        expect(result!.organization).toEqual({ id: "org-1", name: "Acme", slug: "acme" });
    });
});
