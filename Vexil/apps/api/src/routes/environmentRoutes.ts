import { FastifyInstance } from "fastify";
import { EnvironmentController } from "../controllers/EnvironmentController";
import { EnvironmentService } from "../services/EnvironmentService";
import { ProjectService } from "../services/ProjectService";
import { Environment } from "../entities/Environment";
import { Project } from "../entities/Project";
import { requireRole } from "../middleware/rbacMiddleware";
import { UserRole } from "../entities/User";
import { LIMITS } from "../app";

export default async function environmentRoutes(fastify: FastifyInstance) {
    const ctrl = new EnvironmentController(new EnvironmentService(fastify.orm.getRepository(Environment), fastify.redis), new ProjectService(fastify.orm.getRepository(Project)));
    const adminOrMember = requireRole([UserRole.ADMIN, UserRole.MEMBER]);
    const adminOnly = requireRole([UserRole.ADMIN]);
    const s = [{ bearerAuth: [] }];

    fastify.post("/:projectId/environments", { config: { rateLimit: LIMITS.controlWrite }, preHandler: [adminOrMember], schema: { tags: ["Environments"], summary: "Create environment", security: s, body: { type: "object", required: ["name"], properties: { name: { type: "string" } } } } }, ctrl.createEnvironment as any);
    fastify.get("/:projectId/environments", { config: { rateLimit: LIMITS.controlRead }, schema: { tags: ["Environments"], summary: "List environments", security: s } }, ctrl.listEnvironments as any);
    fastify.post("/:projectId/environments/:envId/rotate-key", { config: { rateLimit: LIMITS.controlWrite }, preHandler: [adminOrMember], schema: { tags: ["Environments"], summary: "Rotate API key", security: s } }, ctrl.rotateApiKey as any);
    fastify.delete("/:projectId/environments/:id", { config: { rateLimit: LIMITS.controlWrite }, preHandler: [adminOnly], schema: { tags: ["Environments"], summary: "Delete environment", security: s } }, ctrl.deleteEnvironment as any);
}
