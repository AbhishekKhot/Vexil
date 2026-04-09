import { FastifyInstance } from "fastify";
import { EvaluationController } from "../controllers/EvaluationController";
import { EvaluationService } from "../services/EvaluationService";
import { Environment } from "../entities/Environment";
import { FlagEnvironmentConfig } from "../entities/FlagEnvironmentConfig";
import { EvaluationEvent } from "../entities/EvaluationEvent";

export default async function evaluationRoutes(fastify: FastifyInstance) {
    const ctrl = new EvaluationController(
        new EvaluationService(
            fastify.orm.getRepository(Environment),
            fastify.orm.getRepository(FlagEnvironmentConfig),
            fastify.orm.getRepository(EvaluationEvent),
            fastify.redis
        )
    );

    fastify.post("/flags/evaluate", {
        schema: {
            tags: ["Evaluation"],
            summary: "Evaluate all flags for environment",
            description: "Pass environment API key as Bearer token. Returns all flag values for the given evaluation context.",
            body: {
                type: "object",
                properties: {
                    context: {
                        type: "object",
                        description: "Evaluation context (userId, attributes, etc.)"
                    }
                }
            }
        }
    }, ctrl.eval as any);
}
