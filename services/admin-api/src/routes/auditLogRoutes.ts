import { FastifyInstance } from "fastify";
import { AuditLogController } from "../controllers/AuditLogController";
import { AuditLogService } from "../services/AuditLogService";
import { AuditLog } from "../entities/AuditLog";

export default async function auditLogRoutes(fastify: FastifyInstance) {
    const auditLogRepo = fastify.orm.getRepository(AuditLog);
    const auditLogService = new AuditLogService(auditLogRepo);
    const auditLogController = new AuditLogController(auditLogService);

    const security = [{ bearerAuth: [] }];

    fastify.get("/:projectId/audit-logs", {
        schema: {
            tags: ["Audit Log"],
            summary: "List audit log entries for a project",
            security,
            params: {
                type: "object",
                properties: { projectId: { type: "string" } },
            },
            querystring: {
                type: "object",
                properties: {
                    page: { type: "string", pattern: "^[0-9]+$" },
                    limit: { type: "string", pattern: "^[0-9]+$" },
                    action: { type: "string" },
                    entityType: { type: "string" },
                },
            },
            response: {
                200: {
                    type: "object",
                    properties: {
                        items: { type: "array", items: { $ref: "AuditLog#" } },
                        total: { type: "number" },
                        page: { type: "number" },
                        limit: { type: "number" },
                    },
                },
            },
        },
    }, auditLogController.getLogs as any);

    fastify.get("/:projectId/audit-logs/:id", {
        schema: {
            tags: ["Audit Log"],
            summary: "Get a single audit log entry by ID",
            security,
            params: {
                type: "object",
                properties: {
                    projectId: { type: "string" },
                    id: { type: "string" },
                },
            },
            response: {
                200: { $ref: "AuditLog#" },
                404: { $ref: "Error#" },
            },
        },
    }, auditLogController.getLogById as any);
}
