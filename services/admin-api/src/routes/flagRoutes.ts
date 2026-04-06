import { FastifyInstance } from "fastify";
import { FlagController } from "../controllers/FlagController";
import { FlagService } from "../services/FlagService";
import { ProjectService } from "../services/ProjectService";
import { Flag } from "../entities/Flag";
import { Project } from "../entities/Project";
import { requireRole } from "../middleware/rbacMiddleware";
import { UserRole } from "../entities/User";

export default async function flagRoutes(fastify: FastifyInstance) {
    const flagRepo = fastify.orm.getRepository(Flag);
    const projectRepo = fastify.orm.getRepository(Project);

    const flagService = new FlagService(flagRepo);
    const projectService = new ProjectService(projectRepo);
    const flagController = new FlagController(flagService, projectService);

    const adminOrMember = requireRole([UserRole.ADMIN, UserRole.MEMBER]);
    const adminOnly = requireRole([UserRole.ADMIN]);
    const security = [{ bearerAuth: [] }];

    fastify.post("/:projectId/flags", {
        preHandler: [adminOrMember],
        schema: {
            tags: ["Flags"],
            summary: "Create a new feature flag",
            security,
            params: {
                type: "object",
                properties: { projectId: { type: "string" } },
            },
            body: {
                type: "object",
                required: ["key", "type"],
                properties: {
                    key: { type: "string", description: "Unique slug key for the flag (e.g. new-dashboard)" },
                    description: { type: "string" },
                    type: { type: "string", enum: ["boolean", "string", "number", "json"] },
                },
            },
            response: {
                201: { description: "Flag created", $ref: "Flag#" },
                400: { $ref: "Error#" },
                404: { description: "Project not found", $ref: "Error#" },
            },
        },
    }, flagController.createFlag as any);

    fastify.get("/:projectId/flags", {
        schema: {
            tags: ["Flags"],
            summary: "List all feature flags for a project",
            security,
            params: {
                type: "object",
                properties: { projectId: { type: "string" } },
            },
            response: {
                200: {
                    type: "array",
                    items: { $ref: "Flag#" },
                },
            },
        },
    }, flagController.listFlags as any);

    fastify.get("/:projectId/flags/:flagId", {
        schema: {
            tags: ["Flags"],
            summary: "Get a feature flag by ID",
            security,
            params: {
                type: "object",
                properties: {
                    projectId: { type: "string" },
                    flagId: { type: "string" },
                },
            },
            response: {
                200: { $ref: "Flag#" },
                404: { $ref: "Error#" },
            },
        },
    }, flagController.getFlag as any);

    fastify.put("/:projectId/flags/:flagId", {
        preHandler: [adminOrMember],
        schema: {
            tags: ["Flags"],
            summary: "Update a feature flag's description or type",
            security,
            params: {
                type: "object",
                properties: {
                    projectId: { type: "string" },
                    flagId: { type: "string" },
                },
            },
            body: {
                type: "object",
                properties: {
                    description: { type: "string" },
                    type: { type: "string", enum: ["boolean", "string", "number", "json"] },
                },
            },
            response: {
                200: { description: "Flag updated", $ref: "Flag#" },
                404: { $ref: "Error#" },
            },
        },
    }, flagController.updateFlag as any);

    fastify.delete("/:projectId/flags/:id", {
        preHandler: [adminOnly],
        schema: {
            tags: ["Flags"],
            summary: "Delete a feature flag (ADMIN only)",
            security,
            params: {
                type: "object",
                properties: {
                    projectId: { type: "string" },
                    id: { type: "string" },
                },
            },
            response: {
                204: { description: "Flag deleted", type: "null" },
                403: { $ref: "Error#" },
                404: { $ref: "Error#" },
            },
        },
    }, flagController.deleteFlag as any);
}
