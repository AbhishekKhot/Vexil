import { FastifyInstance } from "fastify";
import { SegmentController } from "../controllers/SegmentController";
import { SegmentService } from "../services/SegmentService";
import { ProjectService } from "../services/ProjectService";
import { AuditLogService } from "../services/AuditLogService";
import { Segment } from "../entities/Segment";
import { Project } from "../entities/Project";
import { AuditLog } from "../entities/AuditLog";

export default async function segmentRoutes(fastify: FastifyInstance) {
    const segmentRepo = fastify.orm.getRepository(Segment);
    const projectRepo = fastify.orm.getRepository(Project);
    const auditLogRepo = fastify.orm.getRepository(AuditLog);
    
    const segmentService = new SegmentService(segmentRepo);
    const projectService = new ProjectService(projectRepo);
    const auditLogService = new AuditLogService(auditLogRepo);
    const segmentController = new SegmentController(segmentService, projectService, auditLogService);

    fastify.post("/:projectId/segments", segmentController.createSegment);
    fastify.get("/:projectId/segments", segmentController.listSegments);
    fastify.get("/:projectId/segments/:segmentId", segmentController.getSegment);
    fastify.delete("/:projectId/segments/:id", segmentController.deleteSegment);
}
