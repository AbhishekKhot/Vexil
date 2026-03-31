import { FastifyInstance } from "fastify";
import { EvaluationController } from "../controllers/EvaluationController";
import { EvaluationService } from "../services/EvaluationService";
import { Environment } from "../entities/Environment";
import { FlagEnvironmentConfig } from "../entities/FlagEnvironmentConfig";
import Redis from "ioredis";

// Use an external redis client factory or instantiate here
// Using a simple singleton pattern roughly for this scope
const defaultRedisOptions = {
    host: process.env.REDIS_HOST || "127.0.0.1",
    port: parseInt(process.env.REDIS_PORT || "6379"),
};

export default async function evaluationRoutes(fastify: FastifyInstance) {
    const envRepo = fastify.orm.getRepository(Environment);
    const configRepo = fastify.orm.getRepository(FlagEnvironmentConfig);
    
    // Inject the Fastify instances' redis if available, or create new.
    // Assuming we extend fastify later, for now just create a local client
    const RedisMock = require('ioredis-mock');
    const redisClient = process.env.NODE_ENV === 'test' ? new RedisMock() : new Redis(defaultRedisOptions);

    const evaluationService = new EvaluationService(envRepo, configRepo, redisClient);
    const evalController = new EvaluationController(evaluationService);

    fastify.post("/eval", evalController.eval);
}
