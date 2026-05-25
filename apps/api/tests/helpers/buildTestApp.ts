import Fastify, { FastifyInstance } from "fastify";
import { vi } from "vitest";
import * as jwt from "jsonwebtoken";
import { UserRole } from "../../src/entities/User";

export const TEST_JWT_SECRET = "test-secret-at-least-32-chars-long!!";
export const TEST_ORG_ID = "org-test-1";
export const TEST_USER_ID = "user-test-1";

export function signToken(payload: { userId?: string; email?: string; organizationId?: string; role?: UserRole } = {}) {
    return jwt.sign(
        {
            userId: payload.userId ?? TEST_USER_ID,
            email: payload.email ?? "admin@test.com",
            organizationId: payload.organizationId ?? TEST_ORG_ID,
            role: payload.role ?? UserRole.ADMIN,
        },
        TEST_JWT_SECRET,
        { expiresIn: "1h" }
    );
}

export async function buildTestApp(
    registerRoutes: (app: FastifyInstance, fakeOrm: any) => Promise<void>
): Promise<FastifyInstance> {
    process.env.JWT_SECRET = TEST_JWT_SECRET;
    process.env.NODE_ENV = "test";

    const fakeOrm = {
        getRepository: vi.fn().mockReturnValue({
            findOne: vi.fn(),
            find: vi.fn(),
            save: vi.fn(),
            create: vi.fn(),
            delete: vi.fn(),
            insert: vi.fn(),
            createQueryBuilder: vi.fn(),
        }),
        query: vi.fn().mockResolvedValue([]),
    };

    const fakeRedis = {
        ping: vi.fn().mockResolvedValue("PONG"),
        get: vi.fn().mockResolvedValue(null),
        set: vi.fn().mockResolvedValue("OK"),
        del: vi.fn().mockResolvedValue(1),
    };

    const app = Fastify({ logger: false });

    app.decorate("orm", fakeOrm);
    app.decorate("redis", fakeRedis);

    app.decorate("authenticate", async (request: any, reply: any) => {
        const auth = request.headers.authorization;
        if (!auth ?.startsWith("Bearer ")) {
            return reply.code(401).send({ error: "Unauthorized" });
        }
        try {
            const token = auth.slice(7);
            const payload = jwt.verify(token, TEST_JWT_SECRET) as any;
            request.user = { id: payload.userId, email: payload.email, organizationId: payload.organizationId, role: payload.role };
        } catch {
            return reply.code(401).send({ error: "Unauthorized" });
        }
    });

    await registerRoutes(app, fakeOrm);
    await app.ready();
    return app;
}
