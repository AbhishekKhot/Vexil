import { FastifyRequest, FastifyReply } from "fastify";
import { EvaluationService } from "../services/EvaluationService";
import { extractApiKey } from "../utils/extractApiKey";

export class EvaluationController {
    constructor(private readonly evaluationService: EvaluationService) {}

    /**
     * POST /v1/flags/evaluate
     * Authenticates via environment API key (Bearer vex_…).
     * Returns the full flag evaluation result set for the calling environment.
     */
    eval = async (request: FastifyRequest<{ Headers: { authorization?: string }; Body: { context?: Record<string, unknown> } }>, reply: FastifyReply) => {
        try {
            const apiKey = extractApiKey(request.headers.authorization);
            if (!apiKey) return reply.code(401).send({ error: "Missing or invalid Bearer token" });

            const flags = await this.evaluationService.evaluateFlags(apiKey, request.body?.context);
            return reply.code(200).send({ flags });
        } catch (error: any) {
            if (error.message === "Invalid API Key") return reply.code(401).send({ error: "Unauthorized: Invalid API Key" });
            return reply.code(500).send({ error: "Internal Server Error" });
        }
    };
}
