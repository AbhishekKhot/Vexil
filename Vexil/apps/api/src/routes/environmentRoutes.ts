import { FastifyInstance } from "fastify";
import { EnvironmentController } from "../controllers/EnvironmentController";
import { EnvironmentService } from "../services/EnvironmentService";
import { ProjectService } from "../services/ProjectService";
import { Environment } from "../entities/Environment";
import { Project } from "../entities/Project";
import { requireRole } from "../middleware/rbacMiddleware";
import { UserRole } from "../entities/User";
import { LIMITS } from "../app";
import environmentSchemas from "./schemas/environment.schema.json";

export default async function environmentRoutes(fastify: FastifyInstance) {
    const ctrl = new EnvironmentController(
        new EnvironmentService(fastify.orm.getRepository(Environment), fastify.redis),
        new ProjectService(fastify.orm.getRepository(Project)),
    );
    const adminOrMember = requireRole([UserRole.ADMIN, UserRole.MEMBER]);
    const adminOnly     = requireRole([UserRole.ADMIN]);

    fastify.post("/:projectId/environments", {
        config:     { rateLimit: LIMITS.controlWrite },
        preHandler: [adminOrMember],
        schema:     environmentSchemas.createEnvironment,
    }, ctrl.createEnvironment as any);

    fastify.get("/:projectId/environments", {
        config: { rateLimit: LIMITS.controlRead },
        schema: environmentSchemas.listEnvironments,
    }, ctrl.listEnvironments as any);

    // Rotate generates a new API key and busts the Redis cache for the old one.
    fastify.post("/:projectId/environments/:envId/rotate-key", {
        config:     { rateLimit: LIMITS.controlWrite },
        preHandler: [adminOrMember],
        schema:     environmentSchemas.rotateApiKey,
    }, ctrl.rotateApiKey as any);

    fastify.delete("/:projectId/environments/:id", {
        config:     { rateLimit: LIMITS.controlWrite },
        preHandler: [adminOnly],
        schema:     environmentSchemas.deleteEnvironment,
    }, ctrl.deleteEnvironment as any);
}
