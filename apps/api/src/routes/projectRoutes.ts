import { FastifyInstance } from "fastify";
import { ProjectController } from "../controllers/ProjectController";
import { ProjectService } from "../services/ProjectService";
import { Project } from "../entities/Project";
import { requireRole } from "../middleware/rbacMiddleware";
import { UserRole } from "../entities/User";
import { LIMITS } from "../app";
import projectSchemas from "./schemas/project.schema.json";

export default async function projectRoutes(fastify: FastifyInstance) {
    const ctrl = new ProjectController(
        new ProjectService(fastify.orm.getRepository(Project)),
    );
    const adminOrMember = requireRole([UserRole.ADMIN, UserRole.MEMBER]);
    const adminOnly = requireRole([UserRole.ADMIN]);

    fastify.post("/", {
        config: { rateLimit: LIMITS.controlWrite },
        preHandler: [adminOrMember],
        schema: projectSchemas.createProject,
    }, ctrl.createProject as any);

    fastify.get("/", {
        config: { rateLimit: LIMITS.controlRead },
        schema: projectSchemas.listProjects,
    }, ctrl.listProjects as any);

    fastify.get("/:id", {
        config: { rateLimit: LIMITS.controlRead },
        schema: projectSchemas.getProject,
    }, ctrl.getProject as any);

    fastify.delete("/:id", {
        config: { rateLimit: LIMITS.controlWrite },
        preHandler: [adminOnly],
        schema: projectSchemas.deleteProject,
    }, ctrl.deleteProject as any);
}
