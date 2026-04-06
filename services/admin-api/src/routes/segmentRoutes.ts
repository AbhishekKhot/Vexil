import { FastifyInstance } from "fastify";
import { SegmentController } from "../controllers/SegmentController";
import { SegmentService } from "../services/SegmentService";
import { ProjectService } from "../services/ProjectService";
import { Segment } from "../entities/Segment";
import { Project } from "../entities/Project";
import { requireRole } from "../middleware/rbacMiddleware";
import { UserRole } from "../entities/User";

export default async function segmentRoutes(fastify: FastifyInstance) {
    const segmentRepo = fastify.orm.getRepository(Segment);
    const projectRepo = fastify.orm.getRepository(Project);

    const segmentService = new SegmentService(segmentRepo);
    const projectService = new ProjectService(projectRepo);
    const segmentController = new SegmentController(segmentService, projectService);

    const adminOrMember = requireRole([UserRole.ADMIN, UserRole.MEMBER]);
    const adminOnly = requireRole([UserRole.ADMIN]);
    const security = [{ bearerAuth: [] }];

    const segmentBody = {
        type: "object",
        properties: {
            name: { type: "string" },
            description: { type: "string" },
            rules: {
                type: "array",
                items: {
                    type: "object",
                    required: ["attribute", "operator", "values"],
                    properties: {
                        attribute: { type: "string", description: "User attribute to match (e.g. country, tier)" },
                        operator: { type: "string", enum: ["eq", "neq", "gt", "lt", "in", "nin", "regex"] },
                        values: { type: "array", items: { type: "string" } },
                    },
                },
            },
        },
    };

    fastify.post("/:projectId/segments", {
        preHandler: [adminOrMember],
        schema: {
            tags: ["Segments"],
            summary: "Create a new user segment",
            security,
            params: {
                type: "object",
                properties: { projectId: { type: "string" } },
            },
            body: { ...segmentBody, required: ["name", "rules"] },
            response: {
                201: { description: "Segment created", $ref: "Segment#" },
                404: { $ref: "Error#" },
            },
        },
    }, segmentController.createSegment as any);

    fastify.get("/:projectId/segments", {
        schema: {
            tags: ["Segments"],
            summary: "List all segments for a project",
            security,
            params: {
                type: "object",
                properties: { projectId: { type: "string" } },
            },
            response: {
                200: {
                    type: "array",
                    items: { $ref: "Segment#" },
                },
            },
        },
    }, segmentController.listSegments as any);

    fastify.get("/:projectId/segments/:segmentId", {
        schema: {
            tags: ["Segments"],
            summary: "Get a segment by ID",
            security,
            params: {
                type: "object",
                properties: {
                    projectId: { type: "string" },
                    segmentId: { type: "string" },
                },
            },
            response: {
                200: { $ref: "Segment#" },
                404: { $ref: "Error#" },
            },
        },
    }, segmentController.getSegment as any);

    fastify.put("/:projectId/segments/:segmentId", {
        preHandler: [adminOrMember],
        schema: {
            tags: ["Segments"],
            summary: "Update a segment's name, description, or rules",
            security,
            params: {
                type: "object",
                properties: {
                    projectId: { type: "string" },
                    segmentId: { type: "string" },
                },
            },
            body: segmentBody,
            response: {
                200: { description: "Segment updated", $ref: "Segment#" },
                404: { $ref: "Error#" },
            },
        },
    }, segmentController.updateSegment as any);

    fastify.delete("/:projectId/segments/:id", {
        preHandler: [adminOnly],
        schema: {
            tags: ["Segments"],
            summary: "Delete a segment (ADMIN only)",
            security,
            params: {
                type: "object",
                properties: {
                    projectId: { type: "string" },
                    id: { type: "string" },
                },
            },
            response: {
                204: { description: "Segment deleted", type: "null" },
                403: { $ref: "Error#" },
                404: { $ref: "Error#" },
            },
        },
    }, segmentController.deleteSegment as any);
}
