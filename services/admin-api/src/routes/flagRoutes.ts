import { FastifyInstance } from "fastify";
import { FlagController } from "../controllers/FlagController";
import { FlagService } from "../services/FlagService";
import { ProjectService } from "../services/ProjectService";
import { AuditLogService } from "../services/AuditLogService";
import { Flag } from "../entities/Flag";
import { Project } from "../entities/Project";
import { AuditLog } from "../entities/AuditLog";

export default async function flagRoutes(fastify: FastifyInstance) {
    const flagRepo = fastify.orm.getRepository(Flag);
    const projectRepo = fastify.orm.getRepository(Project);
    const auditLogRepo = fastify.orm.getRepository(AuditLog);
    
    const flagService = new FlagService(flagRepo);
    const projectService = new ProjectService(projectRepo);
    const auditLogService = new AuditLogService(auditLogRepo);
    const flagController = new FlagController(flagService, projectService, auditLogService);

    fastify.post("/:projectId/flags", flagController.createFlag);
    fastify.get("/:projectId/flags", flagController.listFlags);
    fastify.get("/:projectId/flags/:flagId", flagController.getFlag);
    fastify.delete("/:projectId/flags/:id", flagController.deleteFlag);
}
