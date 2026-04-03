import { FastifyInstance } from "fastify";
import { EvaluationController } from "../controllers/EvaluationController";
import { EvaluationService } from "../services/EvaluationService";
import { Environment } from "../entities/Environment";
import { FlagEnvironmentConfig } from "../entities/FlagEnvironmentConfig";
import { EvaluationEvent } from "../entities/EvaluationEvent";
export default async function evaluationRoutes(fastify: FastifyInstance) {
    const envRepo = fastify.orm.getRepository(Environment);
    const configRepo = fastify.orm.getRepository(FlagEnvironmentConfig);
    const eventRepo = fastify.orm.getRepository(EvaluationEvent);
    
    const evaluationService = new EvaluationService(envRepo, configRepo, eventRepo, fastify.redis);
    const evalController = new EvaluationController(evaluationService);

    fastify.post("/eval", {
        schema: {
            tags: ["Evaluation"],
            summary: "Evaluate all flags for a given context (data plane — API key auth)",
            security: [{ apiKeyAuth: [] }],
            headers: {
                type: "object",
                required: ["x-api-key"],
                properties: {
                    "x-api-key": { type: "string", description: "Environment API key (vex_...)" },
                },
            },
            body: {
                type: "object",
                properties: {
                    context: {
                        type: "object",
                        description: "User/request attributes for evaluation (userId, country, tier, etc.)",
                        properties: {
                            userId: { type: "string" },
                        },
                        additionalProperties: true,
                    },
                },
            },
            response: {
                200: {
                    type: "object",
                    properties: {
                        flags: {
                            type: "object",
                            description: "Map of flag key → evaluation result",
                            additionalProperties: {
                                type: "object",
                                properties: {
                                    value: { description: "Evaluated flag value (boolean, string, number, or object)" },
                                    type: { type: "string", enum: ["boolean", "string", "number", "json"] },
                                    variant: { type: "string", nullable: true },
                                    reason: { type: "string", description: "Evaluation reason (e.g. ROLLOUT, USER_TARGETING, DEFAULT)" },
                                },
                            },
                        },
                    },
                },
                401: { description: "Invalid or missing API key", $ref: "Error#" },
            },
        },
    }, evalController.eval as any);
}
