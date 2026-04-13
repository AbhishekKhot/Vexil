import { FastifyInstance } from "fastify";
import { AnalyticsController } from "../controllers/AnalyticsController";
import { AnalyticsService } from "../services/AnalyticsService";
import { EvaluationEvent } from "../entities/EvaluationEvent";
import { Environment } from "../entities/Environment";
import { Project } from "../entities/Project";
import { requireRole } from "../middleware/rbacMiddleware";
import { UserRole } from "../entities/User";
import { LIMITS } from "../app";
import analyticsSchemas from "./schemas/analytics.schema.json";

/** Builds the AnalyticsService from the Fastify ORM context. */
function makeService(fastify: FastifyInstance) {
    return new AnalyticsService(
        fastify.orm.getRepository(Environment),
        fastify.orm.getRepository(EvaluationEvent),
        fastify.orm.getRepository(Project),
    );
}

/**
 * Data-plane: POST /v1/events
 * Authenticated with environment API key (Bearer vex_…).
 * SDK clients flush their in-memory event buffers here.
 */
export async function analyticsDataRoutes(fastify: FastifyInstance) {
    const ctrl = new AnalyticsController(makeService(fastify));

    fastify.post("/events", {
        config: { rateLimit: LIMITS.events },
        schema: analyticsSchemas.ingest,
    }, ctrl.ingest as any);
}

/**
 * Control-plane: GET /api/projects/:projectId/stats
 * JWT-protected; available to all roles (VIEWER included) for read-only dashboard use.
 */
export async function analyticsControlRoutes(fastify: FastifyInstance) {
    const ctrl   = new AnalyticsController(makeService(fastify));
    const viewer = requireRole([UserRole.ADMIN, UserRole.MEMBER, UserRole.VIEWER]);

    fastify.get("/:projectId/stats", {
        config:     { rateLimit: LIMITS.controlRead },
        preHandler: [viewer],
        schema:     analyticsSchemas.getAnalytics,
    }, ctrl.getAnalytics as any);
}
