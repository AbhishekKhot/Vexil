import { FastifyInstance } from "fastify";
import { EnvironmentController } from "../controllers/EnvironmentController";
import { EnvironmentService } from "../services/EnvironmentService";
import { ProjectService } from "../services/ProjectService";
import { Environment } from "../entities/Environment";
import { Project } from "../entities/Project";

export default async function environmentRoutes(fastify: FastifyInstance) {
    const envRepo = fastify.orm.getRepository(Environment);
    const projectRepo = fastify.orm.getRepository(Project);
    
    const environmentService = new EnvironmentService(envRepo);
    const projectService = new ProjectService(projectRepo);
    const environmentController = new EnvironmentController(environmentService, projectService);

    fastify.post("/:projectId/environments", environmentController.createEnvironment);
    fastify.get("/:projectId/environments", environmentController.listEnvironments);
    fastify.delete("/environments/:id", environmentController.deleteEnvironment);
}
