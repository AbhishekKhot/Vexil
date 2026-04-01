import { FastifyInstance } from "fastify";
import { ProjectController } from "../controllers/ProjectController";
import { ProjectService } from "../services/ProjectService";
import { Project } from "../entities/Project";

export default async function projectRoutes(fastify: FastifyInstance) {
    const projectRepo = fastify.orm.getRepository(Project);
    const projectService = new ProjectService(projectRepo);
    const projectController = new ProjectController(projectService);

    fastify.post("/", projectController.createProject);
    fastify.get("/", projectController.listProjects);
    fastify.get("/:id", projectController.getProject);
    fastify.delete("/:id", projectController.deleteProject);
}
