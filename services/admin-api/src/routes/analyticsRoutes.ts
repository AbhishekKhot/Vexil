import { FastifyInstance } from "fastify";
import { AnalyticsController } from "../controllers/AnalyticsController";
import { AnalyticsService } from "../services/AnalyticsService";
import { Environment } from "../entities/Environment";
import { rabbitMQConfig } from "../utils/rabbitmq";

export default async function analyticsRoutes(fastify: FastifyInstance) {
    const envRepo = fastify.orm.getRepository(Environment);
    
    // Wire up real publisher function
    const publishFn = async (payload: any) => {
        // In local/test environments if not connected yet, we could skip or mock.
        if (process.env.NODE_ENV === 'test') { return true; }
        return await rabbitMQConfig.publishEvent(payload);
    };

    const analyticsService = new AnalyticsService(envRepo, publishFn);
    const analyticsController = new AnalyticsController(analyticsService);

    fastify.post("/events", analyticsController.ingest);
}
