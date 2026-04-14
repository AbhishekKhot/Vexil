import { FastifyInstance } from "fastify";
import { FlagConfigController } from "../controllers/FlagConfigController";
import { FlagConfigService } from "../services/FlagConfigService";
import { FlagService } from "../services/FlagService";
import { EnvironmentService } from "../services/EnvironmentService";
import { FlagEnvironmentConfig } from "../entities/FlagEnvironmentConfig";
import { Flag } from "../entities/Flag";
import { Environment } from "../entities/Environment";
import { requireRole } from "../middleware/rbacMiddleware";
import { UserRole } from "../entities/User";
import { LIMITS } from "../app";
import flagConfigSchemas from "./schemas/flagConfig.schema.json";

export default async function flagConfigRoutes(fastify: FastifyInstance) {
    const ctrl = new FlagConfigController(
        new FlagConfigService(fastify.orm.getRepository(FlagEnvironmentConfig), fastify.redis),
        new FlagService(fastify.orm.getRepository(Flag)),
        new EnvironmentService(fastify.orm.getRepository(Environment), fastify.redis),
    );
    const adminOrMember = requireRole([UserRole.ADMIN, UserRole.MEMBER]);

    // Endpoint pattern: /projects/:projectId/environments/:environmentId/flags/:flagId
    // A single config row represents one flag's state inside one environment.
    fastify.get("/:projectId/environments/:environmentId/flags/:flagId", {
        config: { rateLimit: LIMITS.controlRead },
        schema: flagConfigSchemas.getFlagConfig,
    }, ctrl.getFlagConfig as any);

    fastify.put("/:projectId/environments/:environmentId/flags/:flagId", {
        config: { rateLimit: LIMITS.controlWrite },
        preHandler: [adminOrMember],
        schema: flagConfigSchemas.setFlagConfig,
    }, ctrl.setFlagConfig as any);
}
