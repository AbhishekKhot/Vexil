import Fastify from "fastify";
import { DataSource } from "typeorm";
import Redis from "ioredis";
import projectRoutes from "./routes/projectRoutes";
import environmentRoutes from "./routes/environmentRoutes";
import flagRoutes from "./routes/flagRoutes";
import flagConfigRoutes from "./routes/flagConfigRoutes";
import segmentRoutes from "./routes/segmentRoutes";
import evaluationRoutes from "./routes/evaluationRoutes";
import authRoutes from "./routes/authRoutes";
import auditLogRoutes from "./routes/auditLogRoutes";
import { analyticsDataRoutes, analyticsControlRoutes } from "./routes/analyticsRoutes";
import { authMiddleware } from "./middleware/authMiddleware";
import { registerOpenApi } from "./openapi";
import { getRedisClient } from "./utils/redis";

// Extend Fastify's type system so orm and redis are available on fastify.orm / fastify.redis
// throughout the codebase without casting.
declare module 'fastify' {
    interface FastifyInstance {
        orm: DataSource;
        redis: Redis;
    }
}

/**
 * Builds and configures the Fastify app.
 * Routes are split into two planes:
 *   - Control plane (/api/*): JWT-protected, used by the management UI.
 *   - Data plane (/v1/*): API-key-protected, used by SDK clients at evaluation time.
 */
export async function buildApp(dataSource: DataSource) {
    const fastify = Fastify({
        logger: {
            level: 'info',
            // pino-pretty is dev-only — in production, logs are JSON for log aggregators.
            transport: process.env.NODE_ENV === 'development' ? { target: 'pino-pretty' } : undefined
        }
    });

    await registerOpenApi(fastify);

    fastify.decorate("orm", dataSource);
    fastify.decorate("redis", getRedisClient());

    authMiddleware(fastify);

    fastify.get("/health", async () => ({ status: "ok" }));

    // Auth routes are public — no JWT hook applied.
    fastify.register(authRoutes, { prefix: "/api/auth" });

    // All control plane routes share the same JWT authenticate hook via the scoped plugin.
    fastify.register(async (api) => {
        api.addHook("onRequest", fastify.authenticate);
        api.register(projectRoutes, { prefix: "/projects" });
        api.register(environmentRoutes, { prefix: "/projects" });
        api.register(flagRoutes, { prefix: "/projects" });
        api.register(flagConfigRoutes, { prefix: "/projects" });
        api.register(segmentRoutes, { prefix: "/projects" });
        api.register(auditLogRoutes, { prefix: "/projects" });
        api.register(analyticsControlRoutes, { prefix: "/projects" });
    }, { prefix: "/api" });

    // Data plane routes handle their own API key auth internally.
    fastify.register(evaluationRoutes, { prefix: "/v1" });
    fastify.register(analyticsDataRoutes, { prefix: "/v1" });

    return fastify;
}
