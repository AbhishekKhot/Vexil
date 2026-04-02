import { FastifyInstance } from "fastify";
import { EnvironmentController } from "../controllers/EnvironmentController";
import { EnvironmentService } from "../services/EnvironmentService";
import { ProjectService } from "../services/ProjectService";
import { AuditLogService } from "../services/AuditLogService";
import { Environment } from "../entities/Environment";
import { Project } from "../entities/Project";
import { AuditLog } from "../entities/AuditLog";

export default async function environmentRoutes(fastify: FastifyInstance) {
    const envRepo = fastify.orm.getRepository(Environment);
    const projectRepo = fastify.orm.getRepository(Project);
    const auditLogRepo = fastify.orm.getRepository(AuditLog);
    
    const environmentService = new EnvironmentService(envRepo, fastify.redis);
    const projectService = new ProjectService(projectRepo);
    const auditLogService = new AuditLogService(auditLogRepo);
    const environmentController = new EnvironmentController(environmentService, projectService, auditLogService);

    fastify.post("/:projectId/environments", environmentController.createEnvironment);
    fastify.get("/:projectId/environments", environmentController.listEnvironments);
    fastify.delete("/:projectId/environments/:id", environmentController.deleteEnvironment);
}
