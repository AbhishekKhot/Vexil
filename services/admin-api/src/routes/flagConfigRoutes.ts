import { FastifyInstance } from "fastify";
import { FlagConfigController } from "../controllers/FlagConfigController";
import { FlagConfigService } from "../services/FlagConfigService";
import { FlagService } from "../services/FlagService";
import { EnvironmentService } from "../services/EnvironmentService";
import { FlagEnvironmentConfig } from "../entities/FlagEnvironmentConfig";
import { Flag } from "../entities/Flag";
import { Environment } from "../entities/Environment";

export default async function flagConfigRoutes(fastify: FastifyInstance) {
    const flagConfigRepo = fastify.orm.getRepository(FlagEnvironmentConfig);
    const flagRepo = fastify.orm.getRepository(Flag);
    const envRepo = fastify.orm.getRepository(Environment);
    
    const flagConfigService = new FlagConfigService(flagConfigRepo);
    const flagService = new FlagService(flagRepo);
    const envService = new EnvironmentService(envRepo);
    
    const flagConfigController = new FlagConfigController(flagConfigService, flagService, envService);

    fastify.get("/:projectId/environments/:environmentId/flags/:flagId", flagConfigController.getFlagConfig);
    fastify.put("/:projectId/environments/:environmentId/flags/:flagId", flagConfigController.setFlagConfig);
}
