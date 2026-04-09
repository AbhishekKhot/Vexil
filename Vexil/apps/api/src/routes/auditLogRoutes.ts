import { FastifyInstance } from "fastify";
import { AuditLogController } from "../controllers/AuditLogController";
import { AuditLogService } from "../services/AuditLogService";
import { AuditLog } from "../entities/AuditLog";
import { requireRole } from "../middleware/rbacMiddleware";
import { UserRole } from "../entities/User";

export default async function auditLogRoutes(fastify: FastifyInstance) {
    const ctrl = new AuditLogController(
        new AuditLogService(fastify.orm.getRepository(AuditLog))
    );
    const viewer = requireRole([UserRole.ADMIN, UserRole.MEMBER, UserRole.VIEWER]);
    const s = [{ bearerAuth: [] }];

    fastify.get("/:projectId/audit-logs", {
        preHandler: [viewer],
        schema: {
            tags: ["Audit Logs"],
            summary: "List audit logs for project",
            security: s,
            querystring: {
                type: "object",
                properties: {
                    page: { type: "string" },
                    limit: { type: "string" },
                    action: { type: "string" },
                    entityType: { type: "string" }
                }
            }
        }
    }, ctrl.getLogs as any);

    fastify.get("/:projectId/audit-logs/:id", {
        preHandler: [viewer],
        schema: { tags: ["Audit Logs"], summary: "Get audit log by ID", security: s }
    }, ctrl.getLogById as any);
}
