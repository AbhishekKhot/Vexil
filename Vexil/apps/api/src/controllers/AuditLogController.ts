import { FastifyRequest, FastifyReply } from "fastify";
import { AuditLogService } from "../services/AuditLogService";

export class AuditLogController {
    constructor(private readonly auditLogService: AuditLogService) {}

    getLogs = async (request: FastifyRequest<{ Params: { projectId: string }; Querystring: { page?: string; limit?: string; action?: string; entityType?: string } }>, reply: FastifyReply) => {
        try {
            const page = Math.max(1, parseInt(request.query.page || "1", 10));
            // H8: Cap limit to 100 — service enforces this too, but apply here for clarity.
            const limit = Math.min(Math.max(1, parseInt(request.query.limit || "20", 10)), 100);
            return reply.code(200).send(await this.auditLogService.getLogs(request.params.projectId, { ...request.query, page, limit }));
        } catch { return reply.code(500).send({ error: "Internal Server Error" }); }
    };

    getLogById = async (request: FastifyRequest<{ Params: { projectId: string; id: string } }>, reply: FastifyReply) => {
        // H6: Pass projectId so service verifies org boundary.
        const log = await this.auditLogService.getLogById(request.params.id, request.params.projectId);
        if (!log) return reply.code(404).send({ error: "Audit log not found" });
        return reply.code(200).send(log);
    };
}
