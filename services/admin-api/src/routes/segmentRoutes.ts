import { FastifyInstance } from "fastify";
import { SegmentController } from "../controllers/SegmentController";
import { SegmentService } from "../services/SegmentService";
import { ProjectService } from "../services/ProjectService";
import { Segment } from "../entities/Segment";
import { Project } from "../entities/Project";

export default async function segmentRoutes(fastify: FastifyInstance) {
    const segmentRepo = fastify.orm.getRepository(Segment);
    const projectRepo = fastify.orm.getRepository(Project);
    
    const segmentService = new SegmentService(segmentRepo);
    const projectService = new ProjectService(projectRepo);
    const segmentController = new SegmentController(segmentService, projectService);

    fastify.post("/:projectId/segments", segmentController.createSegment);
    fastify.get("/:projectId/segments", segmentController.listSegments);
    fastify.get("/:projectId/segments/:segmentId", segmentController.getSegment);
}
