import { FastifyInstance } from "fastify";
import { FlagConfigController } from "../controllers/FlagConfigController";
import { FlagConfigService } from "../services/FlagConfigService";
import { FlagService } from "../services/FlagService";
import { EnvironmentService } from "../services/EnvironmentService";
import { AuditLogService } from "../services/AuditLogService";
import { FlagEnvironmentConfig } from "../entities/FlagEnvironmentConfig";
import { Flag } from "../entities/Flag";
import { Environment } from "../entities/Environment";
import { AuditLog } from "../entities/AuditLog";
import { requireRole } from "../middleware/rbacMiddleware";
import { UserRole } from "../entities/User";

export default async function flagConfigRoutes(fastify: FastifyInstance) {
    const flagConfigRepo = fastify.orm.getRepository(FlagEnvironmentConfig);
    const flagRepo = fastify.orm.getRepository(Flag);
    const envRepo = fastify.orm.getRepository(Environment);
    const auditLogRepo = fastify.orm.getRepository(AuditLog);

    const flagConfigService = new FlagConfigService(flagConfigRepo, fastify.redis);
    const flagService = new FlagService(flagRepo);
    const envService = new EnvironmentService(envRepo, fastify.redis);
    const auditLogService = new AuditLogService(auditLogRepo);

    const flagConfigController = new FlagConfigController(flagConfigService, flagService, envService, auditLogService);

    const adminOrMember = requireRole([UserRole.ADMIN, UserRole.MEMBER]);
    const security = [{ bearerAuth: [] }];

    const configParams = {
        type: "object",
        properties: {
            projectId: { type: "string" },
            environmentId: { type: "string" },
            flagId: { type: "string" },
        },
    };

    fastify.get("/:projectId/environments/:environmentId/flags/:flagId", {
        schema: {
            tags: ["Flag Config"],
            summary: "Get the configuration for a flag in a specific environment",
            security,
            params: configParams,
            response: {
                200: { $ref: "FlagConfig#" },
                404: { $ref: "Error#" },
            },
        },
    }, flagConfigController.getFlagConfig as any);

    fastify.put("/:projectId/environments/:environmentId/flags/:flagId", {
        preHandler: [adminOrMember],
        schema: {
            tags: ["Flag Config"],
            summary: "Set (create or update) flag configuration for an environment",
            security,
            params: configParams,
            body: {
                type: "object",
                required: ["isEnabled"],
                properties: {
                    isEnabled: { type: "boolean" },
                    strategyType: {
                        type: "string",
                        enum: ["boolean", "rollout", "targeted_rollout", "user_targeting", "attribute_matching", "ab_test", "time_window", "prerequisite"],
                    },
                    strategyConfig: {
                        type: "object",
                        description: "Strategy-specific configuration object (varies by strategyType)",
                    },
                    scheduledAt: {
                        type: "string",
                        format: "date-time",
                        description: "Optional: schedule a future enable/disable",
                        nullable: true,
                    },
                },
            },
            response: {
                200: { description: "Config saved", $ref: "FlagConfig#" },
                404: { $ref: "Error#" },
            },
        },
    }, flagConfigController.setFlagConfig as any);
}
