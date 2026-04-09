import { FastifyInstance } from "fastify";
import { FlagController } from "../controllers/FlagController";
import { FlagService } from "../services/FlagService";
import { ProjectService } from "../services/ProjectService";
import { Flag } from "../entities/Flag";
import { Project } from "../entities/Project";
import { requireRole } from "../middleware/rbacMiddleware";
import { UserRole } from "../entities/User";
import { LIMITS } from "../app";

export default async function flagRoutes(fastify: FastifyInstance) {
    const ctrl = new FlagController(new FlagService(fastify.orm.getRepository(Flag)), new ProjectService(fastify.orm.getRepository(Project)));
    const adminOrMember = requireRole([UserRole.ADMIN, UserRole.MEMBER]);
    const adminOnly = requireRole([UserRole.ADMIN]);
    const s = [{ bearerAuth: [] }];

    fastify.post("/:projectId/flags", { config: { rateLimit: LIMITS.controlWrite }, preHandler: [adminOrMember], schema: { tags: ["Flags"], summary: "Create flag", security: s, body: { type: "object", required: ["key","type"], properties: { key: { type: "string" }, type: { type: "string" }, description: { type: "string" } } } } }, ctrl.createFlag as any);
    fastify.get("/:projectId/flags", { config: { rateLimit: LIMITS.controlRead }, schema: { tags: ["Flags"], summary: "List flags", security: s } }, ctrl.listFlags as any);
    fastify.get("/:projectId/flags/:flagId", { config: { rateLimit: LIMITS.controlRead }, schema: { tags: ["Flags"], summary: "Get flag", security: s } }, ctrl.getFlag as any);
    fastify.put("/:projectId/flags/:flagId", { config: { rateLimit: LIMITS.controlWrite }, preHandler: [adminOrMember], schema: { tags: ["Flags"], summary: "Update flag", security: s } }, ctrl.updateFlag as any);
    fastify.delete("/:projectId/flags/:id", { config: { rateLimit: LIMITS.controlWrite }, preHandler: [adminOnly], schema: { tags: ["Flags"], summary: "Delete flag", security: s } }, ctrl.deleteFlag as any);
}
