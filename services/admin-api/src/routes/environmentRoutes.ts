import { FastifyInstance } from "fastify";
import { EnvironmentController } from "../controllers/EnvironmentController";
import { EnvironmentService } from "../services/EnvironmentService";
import { ProjectService } from "../services/ProjectService";
import { AuditLogService } from "../services/AuditLogService";
import { Environment } from "../entities/Environment";
import { Project } from "../entities/Project";
import { AuditLog } from "../entities/AuditLog";
import { requireRole } from "../middleware/rbacMiddleware";
import { UserRole } from "../entities/User";

export default async function environmentRoutes(fastify: FastifyInstance) {
    const envRepo = fastify.orm.getRepository(Environment);
    const projectRepo = fastify.orm.getRepository(Project);
    const auditLogRepo = fastify.orm.getRepository(AuditLog);

    const environmentService = new EnvironmentService(envRepo, fastify.redis);
    const projectService = new ProjectService(projectRepo);
    const auditLogService = new AuditLogService(auditLogRepo);
    const environmentController = new EnvironmentController(environmentService, projectService, auditLogService);

    const adminOrMember = requireRole([UserRole.ADMIN, UserRole.MEMBER]);
    const adminOnly = requireRole([UserRole.ADMIN]);
    const security = [{ bearerAuth: [] }];

    fastify.post("/:projectId/environments", {
        preHandler: [adminOrMember],
        schema: {
            tags: ["Environments"],
            summary: "Create a new environment",
            security,
            params: {
                type: "object",
                properties: { projectId: { type: "string" } },
            },
            body: {
                type: "object",
                required: ["name"],
                properties: {
                    name: { type: "string" },
                },
            },
            response: {
                201: { description: "Environment created", $ref: "Environment#" },
                404: { description: "Project not found", $ref: "Error#" },
            },
        },
    }, environmentController.createEnvironment as any);

    fastify.get("/:projectId/environments", {
        schema: {
            tags: ["Environments"],
            summary: "List all environments for a project",
            security,
            params: {
                type: "object",
                properties: { projectId: { type: "string" } },
            },
            response: {
                200: {
                    type: "array",
                    items: { $ref: "Environment#" },
                },
            },
        },
    }, environmentController.listEnvironments as any);

    fastify.post("/:projectId/environments/:envId/rotate-key", {
        preHandler: [adminOrMember],
        schema: {
            tags: ["Environments"],
            summary: "Rotate the API key for an environment",
            security,
            params: {
                type: "object",
                properties: {
                    projectId: { type: "string" },
                    envId: { type: "string" },
                },
            },
            response: {
                200: {
                    description: "New API key",
                    type: "object",
                    properties: {
                        apiKey: { type: "string", description: "The newly generated API key (only shown once)" },
                    },
                },
                404: { $ref: "Error#" },
            },
        },
    }, environmentController.rotateApiKey as any);

    fastify.delete("/:projectId/environments/:id", {
        preHandler: [adminOnly],
        schema: {
            tags: ["Environments"],
            summary: "Delete an environment (ADMIN only)",
            security,
            params: {
                type: "object",
                properties: {
                    projectId: { type: "string" },
                    id: { type: "string" },
                },
            },
            response: {
                204: { description: "Environment deleted", type: "null" },
                403: { $ref: "Error#" },
                404: { $ref: "Error#" },
            },
        },
    }, environmentController.deleteEnvironment as any);
}
