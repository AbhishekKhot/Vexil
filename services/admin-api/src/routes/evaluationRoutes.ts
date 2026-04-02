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

    fastify.post("/eval", evalController.eval);
}
