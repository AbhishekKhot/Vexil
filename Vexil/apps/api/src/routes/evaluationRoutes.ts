import { FastifyInstance } from "fastify";
import { EvaluationController } from "../controllers/EvaluationController";
import { EvaluationService } from "../services/EvaluationService";
import { Environment } from "../entities/Environment";
import { FlagEnvironmentConfig } from "../entities/FlagEnvironmentConfig";
import { EvaluationEvent } from "../entities/EvaluationEvent";
import { makeEvalThrottle } from "../middleware/evalThrottle";
import { LIMITS } from "../app";
import evaluationSchemas from "./schemas/evaluation.schema.json";

export default async function evaluationRoutes(fastify: FastifyInstance) {
    const ctrl = new EvaluationController(
        new EvaluationService(
            fastify.orm.getRepository(Environment),
            fastify.orm.getRepository(FlagEnvironmentConfig),
            fastify.orm.getRepository(EvaluationEvent),
            fastify.redis,
        ),
    );

    // evalThrottle enforces a per-API-key daily cap (MAX_EVAL_PER_DAY env var)
    // on top of the global rate limiter, giving per-environment quota control.
    const evalThrottle = makeEvalThrottle(fastify.redis);

    fastify.post("/flags/evaluate", {
        config:     { rateLimit: LIMITS.evaluate },
        preHandler: [evalThrottle],
        schema:     evaluationSchemas.eval,
    }, ctrl.eval as any);
}
