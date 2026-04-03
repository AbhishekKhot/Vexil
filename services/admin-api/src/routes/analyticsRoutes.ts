import { FastifyInstance } from "fastify";
import { AnalyticsController } from "../controllers/AnalyticsController";
import { AnalyticsService } from "../services/AnalyticsService";
import { Environment } from "../entities/Environment";
import { EvaluationEvent } from "../entities/EvaluationEvent";
import { rabbitMQConfig } from "../utils/rabbitmq";

function buildAnalyticsService(fastify: FastifyInstance) {
    const envRepo = fastify.orm.getRepository(Environment);
    const eventRepo = fastify.orm.getRepository(EvaluationEvent);

    const publishFn = async (payload: any) => {
        if (process.env.NODE_ENV === "test") return true;
        return await rabbitMQConfig.publishEvent(payload);
    };

    return new AnalyticsService(envRepo, eventRepo, publishFn);
}

/** Data-plane: POST /v1/events — API key auth, no JWT required */
export async function analyticsDataRoutes(fastify: FastifyInstance) {
    const analyticsService = buildAnalyticsService(fastify);
    const analyticsController = new AnalyticsController(analyticsService);

    fastify.post("/events", {
        schema: {
            tags: ["Analytics"],
            summary: "Ingest SDK evaluation events (data plane — API key auth)",
            security: [{ apiKeyAuth: [] }],
            headers: {
                type: "object",
                required: ["authorization"],
                properties: {
                    "authorization": { type: "string", description: "Environment API key (Bearer vex_...)" },
                },
            },
            body: {
                type: "array",
                items: {
                    type: "object",
                    required: ["flagKey", "result"],
                    properties: {
                        flagKey: { type: "string" },
                        result: {},
                        context: { type: "object" },
                        timestamp: { type: "string", format: "date-time" },
                    },
                },
            },
             response: {
                202: {
                    type: "object",
                    properties: {
                        status: { type: "string" },
                    },
                },
                401: { description: "Invalid API Key", $ref: "Error#" },
            },
        },
    }, analyticsController.ingest as any);
}

/** Control-plane: GET /api/projects/:projectId/stats — JWT protected */
export async function analyticsControlRoutes(fastify: FastifyInstance) {
    const analyticsService = buildAnalyticsService(fastify);
    const analyticsController = new AnalyticsController(analyticsService);

    fastify.get("/:projectId/stats", {
        schema: {
            tags: ["Analytics"],
            summary: "Get analytics stats for a project",
            security: [{ bearerAuth: [] }],
            params: {
                type: "object",
                properties: { projectId: { type: "string" } },
            },
            querystring: {
                type: "object",
                properties: {
                    environmentId: { type: "string", description: "Filter by environment ID" },
                    flagKey: { type: "string", description: "Filter by flag key" },
                },
            },
            response: {
                200: {
                    type: "array",
                    items: {
                        type: "object",
                        properties: {
                            flagKey: { type: "string" },
                            evaluations: { type: "number" },
                            enabled: { type: "number" },
                            disabled: { type: "number" },
                            passRate: { type: "number", description: "Percentage of enabled evaluations (0–100)" },
                        },
                    },
                },
            },
        },
    }, analyticsController.getAnalytics as any);
}

// Default export kept for backwards compatibility (data plane)
export default analyticsDataRoutes;
