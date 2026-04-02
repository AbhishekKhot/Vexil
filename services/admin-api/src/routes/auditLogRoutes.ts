import { FastifyInstance } from "fastify";
import { AuditLogController } from "../controllers/AuditLogController";
import { AuditLogService } from "../services/AuditLogService";
import { AuditLog } from "../entities/AuditLog";

export default async function auditLogRoutes(fastify: FastifyInstance) {
    const auditLogRepo = fastify.orm.getRepository(AuditLog);
    const auditLogService = new AuditLogService(auditLogRepo);
    const auditLogController = new AuditLogController(auditLogService);

    fastify.get("/:projectId/audit-logs", auditLogController.getLogs);
    fastify.get("/:projectId/audit-logs/:id", auditLogController.getLogById);
}
