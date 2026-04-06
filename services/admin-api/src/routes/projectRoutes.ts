import { FastifyInstance } from "fastify";
import { ProjectController } from "../controllers/ProjectController";
import { ProjectService } from "../services/ProjectService";
import { Project } from "../entities/Project";
import { requireRole } from "../middleware/rbacMiddleware";
import { UserRole } from "../entities/User";

export default async function projectRoutes(fastify: FastifyInstance) {
    const projectRepo = fastify.orm.getRepository(Project);

    const projectService = new ProjectService(projectRepo);
    const projectController = new ProjectController(projectService);

    const adminOrMember = requireRole([UserRole.ADMIN, UserRole.MEMBER]);
    const adminOnly = requireRole([UserRole.ADMIN]);
    const security = [{ bearerAuth: [] }];

    fastify.post("/", {
        preHandler: [adminOrMember],
        schema: {
            tags: ["Projects"],
            summary: "Create a new project",
            security,
            body: {
                type: "object",
                required: ["name"],
                properties: {
                    name: { type: "string" },
                    description: { type: "string" },
                },
            },
            response: {
                201: { description: "Project created", $ref: "Project#" },
                400: { description: "Validation error", $ref: "Error#" },
            },
        },
    }, projectController.createProject as any);

    fastify.get("/", {
        schema: {
            tags: ["Projects"],
            summary: "List all projects for the authenticated user",
            security,
            response: {
                200: {
                    type: "array",
                    items: { $ref: "Project#" },
                },
            },
        },
    }, projectController.listProjects as any);

    fastify.get("/:id", {
        schema: {
            tags: ["Projects"],
            summary: "Get a project by ID",
            security,
            params: {
                type: "object",
                properties: { id: { type: "string" } },
            },
            response: {
                200: { $ref: "Project#" },
                404: { $ref: "Error#" },
            },
        },
    }, projectController.getProject as any);

    fastify.delete("/:id", {
        preHandler: [adminOnly],
        schema: {
            tags: ["Projects"],
            summary: "Delete a project (ADMIN only)",
            security,
            params: {
                type: "object",
                properties: { id: { type: "string" } },
            },
            response: {
                204: { description: "Project deleted", type: "null" },
                403: { $ref: "Error#" },
                404: { $ref: "Error#" },
            },
        },
    }, projectController.deleteProject as any);
}
