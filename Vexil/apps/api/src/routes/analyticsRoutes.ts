import { FastifyInstance } from "fastify";
import { AnalyticsController } from "../controllers/AnalyticsController";
import { AnalyticsService } from "../services/AnalyticsService";
import { EvaluationEvent } from "../entities/EvaluationEvent";
import { Environment } from "../entities/Environment";
import { requireRole } from "../middleware/rbacMiddleware";
import { UserRole } from "../entities/User";

function makeCtrl(fastify: FastifyInstance) {
    return new AnalyticsController(
        new AnalyticsService(
            fastify.orm.getRepository(Environment),
            fastify.orm.getRepository(EvaluationEvent)
        )
    );
}

export async function analyticsDataRoutes(fastify: FastifyInstance) {
    const ctrl = makeCtrl(fastify);

    // Data plane: ingest events (authenticated via env API key)
    fastify.post("/events", {
        schema: {
            tags: ["Analytics"],
            summary: "Ingest evaluation events",
            description: "Pass environment API key as Bearer token.",
            body: {
                type: "array",
                items: {
                    type: "object",
                    required: ["flagKey", "result"],
                    properties: {
                        flagKey: { type: "string" },
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

    // Control plane: query analytics
    fastify.get("/:projectId/stats", {
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
