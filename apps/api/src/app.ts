import Fastify from "fastify";
import cors from "@fastify/cors";
import rateLimit from "@fastify/rate-limit";
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

// ── Rate limit windows (all values in milliseconds) ──────────────────────────
// Kept very tight — this is a portfolio deployment, not a high-traffic service.
// Raise these values if you deploy for real users.
const LIMITS = {
    // Auth: prevent brute-force and org-spam
    register: { max: 5, timeWindow: 24 * 60 * 60 * 1000 }, // 5/day per IP
    login: { max: 10, timeWindow: 15 * 60 * 1000 }, // 10/15min per IP
    authGeneral: { max: 30, timeWindow: 60 * 60 * 1000 }, // 30/hr per IP (GET /me etc.)

    // Control plane: dashboard CRUD operations
    controlWrite: { max: 50, timeWindow: 24 * 60 * 60 * 1000 }, // 50 writes/day per user
    controlRead: { max: 200, timeWindow: 24 * 60 * 60 * 1000 }, // 200 reads/day per user

    // Data plane: SDK evaluation — SDK polls every 30s, so 50/day ≈ 25min of polling
    // Raise MAX_EVAL_PER_DAY env var if needed for demos without redeploying.
    evaluate: { max: parseInt(process.env.MAX_EVAL_PER_DAY || "100", 10), timeWindow: 24 * 60 * 60 * 1000 },
    events: { max: 50, timeWindow: 24 * 60 * 60 * 1000 }, // 50 event batches/day per key
} as const;

/**
 * Builds and configures the Fastify app.
 * Routes are split into two planes:
 *   - Control plane (/api/*): JWT-protected, used by the management UI.
 *   - Data plane (/v1/*): API-key-protected, used by SDK clients at evaluation time.
 */
export async function buildApp(dataSource: DataSource) {
    const fastify = Fastify({
        // 512 KB body limit — prevents large payload abuse on all endpoints.
        bodyLimit: 512 * 1024,
        logger: {
            level: 'info',
            // pino-pretty is dev-only — in production, logs are JSON for log aggregators.
            transport: process.env.NODE_ENV === 'development' ? { target: 'pino-pretty' } : undefined
        }
    });

    // ── CORS ─────────────────────────────────────────────────────────────────
    // In production, restrict to the deployed web URL. In dev, allow localhost:5173.
    const allowedOrigin = process.env.WEB_URL || "http://localhost:5173";
    await fastify.register(cors, {
        origin: (origin, cb) => {
            if (!origin || origin === allowedOrigin) return cb(null, true);
            cb(new Error("Not allowed by CORS"), false);
        },
        methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
        allowedHeaders: ["Content-Type", "Authorization"],
        credentials: true,
    });

    // ── Rate limiting (uses Redis store when available, falls back to in-memory) ──
    await fastify.register(rateLimit, {
        redis: getRedisClient(),
        keyGenerator: (req) => {
            // Use Authorization header as key for data plane (API-key-scoped limiting).
            // Fall back to IP for auth/control plane.
            const auth = req.headers.authorization;
            if (auth ?.startsWith("Bearer vex_")) return `rl:${auth.slice(7, 23)}`; // first 16 chars of key
            return `rl:${req.ip}`;
        },
        errorResponseBuilder: () => ({
            error: "Rate limit exceeded. Too many requests — please slow down.",
            statusCode: 429,
        }),
    });

    await registerOpenApi(fastify);

    fastify.decorate("orm", dataSource);
    fastify.decorate("redis", getRedisClient());

    authMiddleware(fastify);

    // ── Security headers on every response ───────────────────────────────────
    fastify.addHook("onSend", async (_req, reply) => {
        // HSTS: tell browsers to always use HTTPS for 1 year
        reply.header("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
        // Prevent MIME type sniffing
        reply.header("X-Content-Type-Options", "nosniff");
        // Block clickjacking
        reply.header("X-Frame-Options", "DENY");
        // Basic XSS protection header (legacy browsers)
        reply.header("X-XSS-Protection", "1; mode=block");
        // Don't send Referrer header to other origins
        reply.header("Referrer-Policy", "strict-origin-when-cross-origin");
        // Remove Fastify's server fingerprint
        reply.removeHeader("Server");
    });

    // ── Health check (real — pings DB and Redis) ─────────────────────────────
    fastify.get("/health", async (_req, reply) => {
        try {
            await dataSource.query("SELECT 1");
        } catch {
            return reply.code(503).send({ status: "degraded", reason: "database unreachable" });
        }
        try {
            await getRedisClient().ping();
        } catch {
            return reply.code(503).send({ status: "degraded", reason: "redis unreachable" });
        }
        return reply.send({ status: "ok" });
    });

    // ── Auth routes (public, per-route tight limits) ─────────────────────────
    fastify.register(authRoutes, { prefix: "/api/auth" });

    // ── Control plane (JWT auth, per-route limits) ───────────────────────────
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

    // ── Data plane (API-key auth, per-route limits) ───────────────────────────
    fastify.register(evaluationRoutes, { prefix: "/v1" });
    fastify.register(analyticsDataRoutes, { prefix: "/v1" });

    return fastify;
}

// Export limits so route files can reference them without duplication.
export { LIMITS };
