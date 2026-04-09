import { FastifyInstance } from "fastify";
import { AnalyticsController } from "../controllers/AnalyticsController";
import { AnalyticsService } from "../services/AnalyticsService";
import { EvaluationEvent } from "../entities/EvaluationEvent";
import { Environment } from "../entities/Environment";
import { Project } from "../entities/Project";
import { requireRole } from "../middleware/rbacMiddleware";
import { UserRole } from "../entities/User";
import { LIMITS } from "../app";

function makeCtrl(fastify: FastifyInstance) {
    return new AnalyticsController(
        new AnalyticsService(
            fastify.orm.getRepository(Environment),
            fastify.orm.getRepository(EvaluationEvent),
            fastify.orm.getRepository(Project)
        )
    );
}

export async function analyticsDataRoutes(fastify: FastifyInstance) {
    const ctrl = makeCtrl(fastify);

    fastify.post("/events", {
        config: { rateLimit: LIMITS.events },
        schema: {
            tags: ["Analytics"],
            summary: "Ingest evaluation events",
            description: "Pass environment API key as Bearer token. Max 500 events per request.",
            body: {
                type: "array",
                maxItems: 500,
                items: {
                    type: "object",
                    required: ["flagKey", "result"],
                    properties: {
                        flagKey: { type: "string", maxLength: 128 },
                        result: { type: "boolean" },
                        context: { type: "object" },
                        timestamp: { type: "string" }
                    }
                }
            }
        }
    }, ctrl.ingest as any);
}

export async function analyticsControlRoutes(fastify: FastifyInstance) {
    const ctrl = makeCtrl(fastify);
    const viewer = requireRole([UserRole.ADMIN, UserRole.MEMBER, UserRole.VIEWER]);
    const s = [{ bearerAuth: [] }];

    fastify.get("/:projectId/stats", {
        config: { rateLimit: LIMITS.controlRead },
        preHandler: [viewer],
        schema: {
            tags: ["Analytics"],
            summary: "Get flag analytics for project",
            security: s,
            querystring: {
                type: "object",
                properties: {
                    environmentId: { type: "string" },
                    flagKey: { type: "string" }
                }
            }
        }
    }, ctrl.getAnalytics as any);
}
