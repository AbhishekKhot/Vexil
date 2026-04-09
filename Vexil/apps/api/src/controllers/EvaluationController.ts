import { FastifyRequest, FastifyReply } from "fastify";
import { EvaluationService } from "../services/EvaluationService";

export class EvaluationController {
    constructor(private readonly evaluationService: EvaluationService) {}

    eval = async (request: FastifyRequest<{ Headers: { authorization?: string }; Body: { context?: Record<string, unknown> } }>, reply: FastifyReply) => {
        try {
            const authHeader = request.headers.authorization;
            if (!authHeader?.startsWith("Bearer ")) return reply.code(401).send({ error: "Missing or invalid Bearer token" });
            const apiKey = authHeader.replace("Bearer ", "").trim();
            const flags = await this.evaluationService.evaluateFlags(apiKey, request.body?.context);
            return reply.code(200).send({ flags });
        } catch (error: any) {
            if (error.message === "Invalid API Key") return reply.code(401).send({ error: "Unauthorized: Invalid API Key" });
            return reply.code(500).send({ error: "Internal Server Error" });
        }
    };
}
