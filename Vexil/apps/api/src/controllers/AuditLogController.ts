import { FastifyRequest, FastifyReply } from "fastify";
import { AuditLogService } from "../services/AuditLogService";

export class AuditLogController {
    constructor(private readonly auditLogService: AuditLogService) {}

    getLogs = async (request: FastifyRequest<{ Params: { projectId: string }; Querystring: { page?: string; limit?: string; action?: string; entityType?: string } }>, reply: FastifyReply) => {
        try {
            const page = request.query.page ? parseInt(request.query.page, 10) : 1;
            const limit = request.query.limit ? parseInt(request.query.limit, 10) : 20;
            return reply.code(200).send(await this.auditLogService.getLogs(request.params.projectId, { ...request.query, page, limit }));
        } catch { return reply.code(500).send({ error: "Internal Server Error" }); }
    };

    getLogById = async (request: FastifyRequest<{ Params: { projectId: string; id: string } }>, reply: FastifyReply) => {
        const log = await this.auditLogService.getLogById(request.params.id);
        if (!log) return reply.code(404).send({ error: "Audit log not found" });
        return reply.code(200).send(log);
    };
}
