import { FastifyInstance } from "fastify";
import { SegmentController } from "../controllers/SegmentController";
import { SegmentService } from "../services/SegmentService";
import { ProjectService } from "../services/ProjectService";
import { Segment } from "../entities/Segment";
import { Project } from "../entities/Project";
import { requireRole } from "../middleware/rbacMiddleware";
import { UserRole } from "../entities/User";
import { LIMITS } from "../app";
import segmentSchemas from "./schemas/segment.schema.json";

export default async function segmentRoutes(fastify: FastifyInstance) {
    const ctrl = new SegmentController(
        new SegmentService(fastify.orm.getRepository(Segment)),
        new ProjectService(fastify.orm.getRepository(Project)),
    );
    const adminOrMember = requireRole([UserRole.ADMIN, UserRole.MEMBER]);

    fastify.get("/:projectId/segments", {
        config: { rateLimit: LIMITS.controlRead },
        schema: segmentSchemas.listSegments,
    }, ctrl.listSegments as any);

    fastify.post("/:projectId/segments", {
        config: { rateLimit: LIMITS.controlWrite },
        preHandler: [adminOrMember],
        schema: segmentSchemas.createSegment,
    }, ctrl.createSegment as any);

    fastify.get("/:projectId/segments/:segmentId", {
        config: { rateLimit: LIMITS.controlRead },
        schema: segmentSchemas.getSegment,
    }, ctrl.getSegment as any);

    fastify.patch("/:projectId/segments/:segmentId", {
        config: { rateLimit: LIMITS.controlWrite },
        preHandler: [adminOrMember],
        schema: segmentSchemas.updateSegment,
    }, ctrl.updateSegment as any);

    fastify.delete("/:projectId/segments/:id", {
        config: { rateLimit: LIMITS.controlWrite },
        preHandler: [adminOrMember],
        schema: segmentSchemas.deleteSegment,
    }, ctrl.deleteSegment as any);
}
