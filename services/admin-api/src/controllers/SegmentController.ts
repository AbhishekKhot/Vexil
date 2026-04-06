import { FastifyRequest, FastifyReply } from "fastify";
import { SegmentService } from "../services/SegmentService";
import { ProjectService } from "../services/ProjectService";

export class SegmentController {
    constructor(
        private readonly segmentService: SegmentService,
        private readonly projectService: ProjectService
    ) {}

    createSegment = async (
        request: FastifyRequest<{ Params: { projectId: string }, Body: { name: string, rules: any, description?: string } }>, 
        reply: FastifyReply
    ) => {
        try {
            const project = await this.projectService.getProject(request.params.projectId);
            if (!project) {
                return reply.code(404).send({ error: "Project not found" });
            }

            const segment = await this.segmentService.createSegment(
                project,
                request.body?.name,
                request.body?.rules,
                request.body?.description
            );

            return reply.code(201).send(segment);
        } catch (error: any) {
            return reply.code(400).send({ error: error.message });
        }
    };

    listSegments = async (
        request: FastifyRequest<{ Params: { projectId: string } }>, 
        reply: FastifyReply
    ) => {
        try {
            const project = await this.projectService.getProject(request.params.projectId);
            if (!project) {
                return reply.code(404).send({ error: "Project not found" });
            }

            const segments = await this.segmentService.listSegments(project.id);
            return reply.code(200).send(segments);
        } catch (error: any) {
            return reply.code(500).send({ error: "Internal Server Error" });
        }
    };
    
    getSegment = async (
        request: FastifyRequest<{ Params: { projectId: string, segmentId: string } }>, 
        reply: FastifyReply
    ) => {
        try {
            const segment = await this.segmentService.getSegment(request.params.segmentId);
            if (!segment || segment.project.id !== request.params.projectId) {
                return reply.code(404).send({ error: "Segment not found" });
            }

            return reply.code(200).send(segment);
        } catch (error: any) {
            return reply.code(500).send({ error: "Internal Server Error" });
        }
    };

    updateSegment = async (
        request: FastifyRequest<{ Params: { projectId: string; segmentId: string }; Body: { name?: string; description?: string; rules?: any } }>,
        reply: FastifyReply
    ) => {
        try {
            const segment = await this.segmentService.getSegment(request.params.segmentId);
            if (!segment || segment.project.id !== request.params.projectId) {
                return reply.code(404).send({ error: "Segment not found" });
            }

            const updated = await this.segmentService.updateSegment(request.params.segmentId, request.body);

            return reply.code(200).send(updated);
        } catch (error: any) {
            return reply.code(400).send({ error: error.message });
        }
    };

    deleteSegment = async (
        request: FastifyRequest<{ Params: { projectId: string, id: string } }>, 
        reply: FastifyReply
    ) => {
        try {
            const segment = await this.segmentService.getSegment(request.params.id);
            if (!segment) {
                return reply.code(404).send({ error: "Segment not found" });
            }

            const success = await this.segmentService.deleteSegment(request.params.id);
            if (!success) {
                return reply.code(404).send({ error: "Segment not found" });
            }

            return reply.code(204).send();
        } catch (error: any) {
            return reply.code(500).send({ error: "Internal Server Error" });
        }
    };
}
