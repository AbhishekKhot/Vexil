import { FastifyRequest, FastifyReply } from "fastify";
import { AnalyticsService } from "../services/AnalyticsService";

export class AnalyticsController {
    constructor(private readonly analyticsService: AnalyticsService) {}

    ingest = async (
        request: FastifyRequest<{ Headers: { authorization?: string }, Body: any[] }>, 
        reply: FastifyReply
    ) => {
        try {
            const authHeader = request.headers.authorization;
            if (!authHeader || !authHeader.startsWith("Bearer ")) {
                return reply.code(401).send({ error: "Missing or invalid Bearer token (API Key)" });
            }

            const apiKey = authHeader.replace("Bearer ", "").trim();
            const events = request.body;

            await this.analyticsService.ingestEvents(apiKey, events);
            
            // Fast 202 Accepted response for telemetry
            return reply.code(202).send({ status: "accepted" });
        } catch (error: any) {
            if (error.message === "Invalid API Key") {
                return reply.code(401).send({ error: "Unauthorized: Invalid API Key" });
            }
            return reply.code(400).send({ error: error.message });
        }
    };

    getAnalytics = async (
        request: FastifyRequest<{ Params: { projectId: string }, Querystring: { environmentId?: string, flagKey?: string } }>, 
        reply: FastifyReply
    ) => {
        try {
            const stats = await this.analyticsService.getAnalytics(
                request.params.projectId,
                request.query.environmentId,
                request.query.flagKey
            );
            return reply.code(200).send(stats);
        } catch (error: any) {
            return reply.code(500).send({ error: "Internal Server Error" });
        }
    };
}
