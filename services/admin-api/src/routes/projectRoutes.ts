import { FastifyInstance } from "fastify";
import { ProjectController } from "../controllers/ProjectController";
import { ProjectService } from "../services/ProjectService";
import { AuditLogService } from "../services/AuditLogService";
import { Project } from "../entities/Project";
import { AuditLog } from "../entities/AuditLog";

export default async function projectRoutes(fastify: FastifyInstance) {
    const projectRepo = fastify.orm.getRepository(Project);
    const auditLogRepo = fastify.orm.getRepository(AuditLog);
    
    const projectService = new ProjectService(projectRepo);
    const auditLogService = new AuditLogService(auditLogRepo);
    const projectController = new ProjectController(projectService, auditLogService);

    fastify.post("/", projectController.createProject);
    fastify.get("/", projectController.listProjects);
    fastify.get("/:id", projectController.getProject);
    fastify.delete("/:id", projectController.deleteProject);
}
