import { FastifyInstance } from "fastify";
import { AuditLogController } from "../controllers/AuditLogController";
import { AuditLogService } from "../services/AuditLogService";
import { AuditLog } from "../entities/AuditLog";
import { requireRole } from "../middleware/rbacMiddleware";
import { UserRole } from "../entities/User";
import { LIMITS } from "../app";
import auditLogSchemas from "./schemas/auditLog.schema.json";

export default async function auditLogRoutes(fastify: FastifyInstance) {
    const ctrl   = new AuditLogController(new AuditLogService(fastify.orm.getRepository(AuditLog)));
    // All roles can read audit logs — helpful for VIEWERs debugging flag changes.
    const viewer = requireRole([UserRole.ADMIN, UserRole.MEMBER, UserRole.VIEWER]);

    fastify.get("/:projectId/audit-logs", {
        config:     { rateLimit: LIMITS.controlRead },
        preHandler: [viewer],
        schema:     auditLogSchemas.getLogs,
    }, ctrl.getLogs as any);

    fastify.get("/:projectId/audit-logs/:id", {
        config:     { rateLimit: LIMITS.controlRead },
        preHandler: [viewer],
        schema:     auditLogSchemas.getLogById,
    }, ctrl.getLogById as any);
}
