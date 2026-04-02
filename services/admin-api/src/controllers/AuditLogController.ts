import { FastifyRequest, FastifyReply } from "fastify";
import { AuditLogService } from "../services/AuditLogService";

export class AuditLogController {
    constructor(private readonly auditLogService: AuditLogService) {}

    getLogs = async (
        request: FastifyRequest<{ Params: { projectId: string }; Querystring: { page?: string; limit?: string; action?: string; entityType?: string } }>,
        reply: FastifyReply
    ) => {
        const { projectId } = request.params;
        const page = request.query.page ? parseInt(request.query.page, 10) : 1;
        const limit = request.query.limit ? parseInt(request.query.limit, 10) : 20;

        try {
            const logs = await this.auditLogService.getLogs(projectId, {
                ...request.query,
                page,
                limit
            });
            return reply.code(200).send(logs);
        } catch (err) {
            return reply.code(500).send({ error: "Internal Server Error" });
        }
    };
    
    getLogById = async (
        request: FastifyRequest<{ Params: { projectId: string; id: string } }>,
        reply: FastifyReply
    ) => {
        try {
            const { id } = request.params;
            const log = await this.auditLogService.getLogById(id);
            if (!log) {
                return reply.code(404).send({ error: "Audit log not found" });
            }
            return reply.code(200).send(log);
        } catch {
            return reply.code(500).send({ error: "Internal Server Error" });
        }
    };
}
