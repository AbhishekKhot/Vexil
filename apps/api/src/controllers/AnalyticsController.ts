import { FastifyRequest, FastifyReply } from "fastify";
import { AnalyticsService } from "../services/AnalyticsService";
import { extractApiKey } from "../utils/extractApiKey";

export class AnalyticsController {
    constructor(private readonly analyticsService: AnalyticsService) {}

    /**
     * POST /v1/events
     * Authenticates via environment API key (Bearer vex_…).
     * SDK clients flush batched evaluation events here; responds 202 once queued.
     */
    ingest = async (request: FastifyRequest<{ Headers: { authorization?: string }; Body: { flagKey: string; result: boolean; context?: unknown; timestamp?: string }[] }>, reply: FastifyReply) => {
        try {
            const apiKey = extractApiKey(request.headers.authorization);
            if (!apiKey) return reply.code(401).send({ error: "Missing or invalid Bearer token" });

            await this.analyticsService.ingestEvents(apiKey, request.body);
            return reply.code(202).send({ status: "accepted" });
        } catch (error: any) {
            if (error.message === "Invalid API Key") return reply.code(401).send({ error: "Unauthorized: Invalid API Key" });
            return reply.code(400).send({ error: error.message });
        }
    };

    /**
     * GET /api/projects/:projectId/stats
     * JWT-protected; verifies project ownership via organizationId before returning stats.
     */
    getAnalytics = async (request: FastifyRequest<{ Params: { projectId: string }; Querystring: { environmentId?: string; flagKey?: string } }>, reply: FastifyReply) => {
        try {
            const stats = await this.analyticsService.getAnalytics(
                request.params.projectId,
                request.user.organizationId,
                request.query.environmentId,
                request.query.flagKey,
            );
            return reply.code(200).send(stats);
        } catch { return reply.code(500).send({ error: "Internal Server Error" }); }
    };
}
