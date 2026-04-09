import { FastifyInstance } from "fastify";
import { SegmentController } from "../controllers/SegmentController";
import { SegmentService } from "../services/SegmentService";
import { ProjectService } from "../services/ProjectService";
import { Segment } from "../entities/Segment";
import { Project } from "../entities/Project";
import { requireRole } from "../middleware/rbacMiddleware";
import { UserRole } from "../entities/User";
import { LIMITS } from "../app";

export default async function segmentRoutes(fastify: FastifyInstance) {
    const ctrl = new SegmentController(
        new SegmentService(fastify.orm.getRepository(Segment)),
        new ProjectService(fastify.orm.getRepository(Project))
    );
    const adminOrMember = requireRole([UserRole.ADMIN, UserRole.MEMBER]);
    const s = [{ bearerAuth: [] }];

    fastify.get("/:projectId/segments", { config: { rateLimit: LIMITS.controlRead }, schema: { tags: ["Segments"], summary: "List segments", security: s } }, ctrl.listSegments as any);
    fastify.post("/:projectId/segments", { config: { rateLimit: LIMITS.controlWrite }, preHandler: [adminOrMember], schema: { tags: ["Segments"], summary: "Create segment", security: s, body: { type: "object", required: ["name", "rules"], properties: { name: { type: "string" }, description: { type: "string" }, rules: { type: "array" } } } } }, ctrl.createSegment as any);
    fastify.get("/:projectId/segments/:segmentId", { config: { rateLimit: LIMITS.controlRead }, schema: { tags: ["Segments"], summary: "Get segment", security: s } }, ctrl.getSegment as any);
    fastify.patch("/:projectId/segments/:segmentId", { config: { rateLimit: LIMITS.controlWrite }, preHandler: [adminOrMember], schema: { tags: ["Segments"], summary: "Update segment", security: s } }, ctrl.updateSegment as any);
    fastify.delete("/:projectId/segments/:id", { config: { rateLimit: LIMITS.controlWrite }, preHandler: [adminOrMember], schema: { tags: ["Segments"], summary: "Delete segment", security: s } }, ctrl.deleteSegment as any);
}
