import { FastifyInstance } from "fastify";
import { FlagController } from "../controllers/FlagController";
import { FlagService } from "../services/FlagService";
import { ProjectService } from "../services/ProjectService";
import { Flag } from "../entities/Flag";
import { Project } from "../entities/Project";
import { requireRole } from "../middleware/rbacMiddleware";
import { UserRole } from "../entities/User";
import { LIMITS } from "../app";
import flagSchemas from "./schemas/flag.schema.json";

export default async function flagRoutes(fastify: FastifyInstance) {
    const ctrl = new FlagController(
        new FlagService(fastify.orm.getRepository(Flag)),
        new ProjectService(fastify.orm.getRepository(Project)),
    );
    const adminOrMember = requireRole([UserRole.ADMIN, UserRole.MEMBER]);
    const adminOnly     = requireRole([UserRole.ADMIN]);

    fastify.post("/:projectId/flags", {
        config:     { rateLimit: LIMITS.controlWrite },
        preHandler: [adminOrMember],
        schema:     flagSchemas.createFlag,
    }, ctrl.createFlag as any);

    fastify.get("/:projectId/flags", {
        config: { rateLimit: LIMITS.controlRead },
        schema: flagSchemas.listFlags,
    }, ctrl.listFlags as any);

    fastify.get("/:projectId/flags/:flagId", {
        config: { rateLimit: LIMITS.controlRead },
        schema: flagSchemas.getFlag,
    }, ctrl.getFlag as any);

    fastify.put("/:projectId/flags/:flagId", {
        config:     { rateLimit: LIMITS.controlWrite },
        preHandler: [adminOrMember],
        schema:     flagSchemas.updateFlag,
    }, ctrl.updateFlag as any);

    fastify.delete("/:projectId/flags/:id", {
        config:     { rateLimit: LIMITS.controlWrite },
        preHandler: [adminOnly],
        schema:     flagSchemas.deleteFlag,
    }, ctrl.deleteFlag as any);
}
