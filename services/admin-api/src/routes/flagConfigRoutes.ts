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

    fastify.get("/:projectId/environments/:environmentId/flags/:flagId", flagConfigController.getFlagConfig);
    fastify.put("/:projectId/environments/:environmentId/flags/:flagId", flagConfigController.setFlagConfig);
}
