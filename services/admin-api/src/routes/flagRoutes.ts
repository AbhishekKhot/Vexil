import { FastifyInstance } from "fastify";
import { FlagController } from "../controllers/FlagController";
import { FlagService } from "../services/FlagService";
import { ProjectService } from "../services/ProjectService";
import { Flag } from "../entities/Flag";
import { Project } from "../entities/Project";

export default async function flagRoutes(fastify: FastifyInstance) {
    const flagRepo = fastify.orm.getRepository(Flag);
    const projectRepo = fastify.orm.getRepository(Project);
    
    const flagService = new FlagService(flagRepo);
    const projectService = new ProjectService(projectRepo);
    const flagController = new FlagController(flagService, projectService);

    fastify.post("/:projectId/flags", flagController.createFlag);
    fastify.get("/:projectId/flags", flagController.listFlags);
    fastify.get("/:projectId/flags/:flagId", flagController.getFlag);
}
