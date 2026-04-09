import { FastifyInstance } from "fastify";
import { ProjectController } from "../controllers/ProjectController";
import { ProjectService } from "../services/ProjectService";
import { Project } from "../entities/Project";
import { requireRole } from "../middleware/rbacMiddleware";
import { UserRole } from "../entities/User";
import { LIMITS } from "../app";

export default async function projectRoutes(fastify: FastifyInstance) {
    const ctrl = new ProjectController(new ProjectService(fastify.orm.getRepository(Project)));
    const adminOrMember = requireRole([UserRole.ADMIN, UserRole.MEMBER]);
    const adminOnly = requireRole([UserRole.ADMIN]);
    const s = [{ bearerAuth: [] }];

    fastify.post("/", { config: { rateLimit: LIMITS.controlWrite }, preHandler: [adminOrMember], schema: { tags: ["Projects"], summary: "Create project", security: s, body: { type: "object", required: ["name"], properties: { name: { type: "string" }, description: { type: "string" } } } } }, ctrl.createProject as any);
    fastify.get("/", { config: { rateLimit: LIMITS.controlRead }, schema: { tags: ["Projects"], summary: "List projects", security: s } }, ctrl.listProjects as any);
    fastify.get("/:id", { config: { rateLimit: LIMITS.controlRead }, schema: { tags: ["Projects"], summary: "Get project", security: s } }, ctrl.getProject as any);
    fastify.delete("/:id", { config: { rateLimit: LIMITS.controlWrite }, preHandler: [adminOnly], schema: { tags: ["Projects"], summary: "Delete project", security: s } }, ctrl.deleteProject as any);
}
