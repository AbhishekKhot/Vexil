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

export default async function flagConfigRoutes(fastify: FastifyInstance) {
    const ctrl = new FlagConfigController(
        new FlagConfigService(fastify.orm.getRepository(FlagEnvironmentConfig), fastify.redis),
        new FlagService(fastify.orm.getRepository(Flag)),
        new EnvironmentService(fastify.orm.getRepository(Environment), fastify.redis)
    );
    const adminOrMember = requireRole([UserRole.ADMIN, UserRole.MEMBER]);
    const s = [{ bearerAuth: [] }];

    fastify.get("/:projectId/environments/:environmentId/flags/:flagId", { config: { rateLimit: LIMITS.controlRead }, schema: { tags: ["Flag Config"], summary: "Get flag config", security: s } }, ctrl.getFlagConfig as any);
    fastify.put("/:projectId/environments/:environmentId/flags/:flagId", { config: { rateLimit: LIMITS.controlWrite }, preHandler: [adminOrMember], schema: { tags: ["Flag Config"], summary: "Set flag config", security: s, body: { type: "object", required: ["isEnabled"], properties: { isEnabled: { type: "boolean" }, strategyType: { type: "string" }, strategyConfig: { type: "object" }, scheduledAt: { type: "string", nullable: true } } } } }, ctrl.setFlagConfig as any);
}
