import Fastify from "fastify";
import { DataSource } from "typeorm";
import projectRoutes from "./routes/projectRoutes";
import environmentRoutes from "./routes/environmentRoutes";
import flagRoutes from "./routes/flagRoutes";
import flagConfigRoutes from "./routes/flagConfigRoutes";
import segmentRoutes from "./routes/segmentRoutes";
import evaluationRoutes from "./routes/evaluationRoutes";
import authRoutes from "./routes/authRoutes";
import { authMiddleware } from "./middleware/authMiddleware";
import { registerOpenApi } from "./openapi";

import { getRedisClient } from "./utils/redis";
import Redis from "ioredis";

declare module 'fastify' {
    interface FastifyInstance {
        orm: DataSource;
        redis: Redis;
    }
}

export async function buildApp(dataSource: DataSource) {
    const fastify = Fastify({ 
        logger: {
            level: 'info',
            transport: process.env.NODE_ENV === 'development' ? {
                target: 'pino-pretty'
            } : undefined
        } 
    });

    await registerOpenApi(fastify);

    // Decorate fastify with TypeORM instance
    fastify.decorate("orm", dataSource);
    fastify.decorate("redis", getRedisClient());

    // Initialize Auth System
    authMiddleware(fastify);

    // Auth Routes (Public)
    fastify.register(authRoutes, { prefix: "/api/auth" });

    // Control Plane (Protected)
    fastify.register(async (api) => {
        api.addHook("onRequest", fastify.authenticate);

        api.register(projectRoutes, { prefix: "/projects" });
        api.register(environmentRoutes, { prefix: "/projects" });
        api.register(flagRoutes, { prefix: "/projects" });
        api.register(flagConfigRoutes, { prefix: "/projects" });
        api.register(segmentRoutes, { prefix: "/projects" });
        // Analytics stats (JWT-protected, per-project)
        const { analyticsControlRoutes } = require("./routes/analyticsRoutes");
        api.register(analyticsControlRoutes, { prefix: "/projects" });
    }, { prefix: "/api" });

    // Data Plane (Edge) - Public (uses API keys)
    fastify.register(evaluationRoutes, { prefix: "/v1" });
    const { analyticsDataRoutes } = require("./routes/analyticsRoutes");
    fastify.register(analyticsDataRoutes, { prefix: "/v1" });

    return fastify;
}
