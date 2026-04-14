import { FastifyRequest, FastifyReply } from "fastify";
import { SegmentService } from "../services/SegmentService";
import { ProjectService } from "../services/ProjectService";

export class SegmentController {
    constructor(private readonly segmentService: SegmentService, private readonly projectService: ProjectService) { }

    createSegment = async (request: FastifyRequest<{ Params: { projectId: string }; Body: { name: string; rules: unknown; description?: string } }>, reply: FastifyReply) => {
        try {
            const project = await this.projectService.getProject(request.params.projectId);
            if (!project) return reply.code(404).send({ error: "Project not found" });
            return reply.code(201).send(await this.segmentService.createSegment(project, request.body ?.name, request.body ?.rules, request.body ?.description));
        } catch (err: any) { return reply.code(400).send({ error: err.message }); }
    };

    listSegments = async (request: FastifyRequest<{ Params: { projectId: string } }>, reply: FastifyReply) => {
        const project = await this.projectService.getProject(request.params.projectId);
        if (!project) return reply.code(404).send({ error: "Project not found" });
        return reply.code(200).send(await this.segmentService.listSegments(project.id));
    };

    getSegment = async (request: FastifyRequest<{ Params: { projectId: string; segmentId: string } }>, reply: FastifyReply) => {
        const segment = await this.segmentService.getSegment(request.params.segmentId);
        if (!segment || segment.project.id !== request.params.projectId) return reply.code(404).send({ error: "Segment not found" });
        return reply.code(200).send(segment);
    };

    updateSegment = async (request: FastifyRequest<{ Params: { projectId: string; segmentId: string }; Body: { name?: string; description?: string; rules?: unknown } }>, reply: FastifyReply) => {
        try {
            const segment = await this.segmentService.getSegment(request.params.segmentId);
            if (!segment || segment.project.id !== request.params.projectId) return reply.code(404).send({ error: "Segment not found" });
            return reply.code(200).send(await this.segmentService.updateSegment(request.params.segmentId, request.body));
        } catch (err: any) { return reply.code(400).send({ error: err.message }); }
    };

    deleteSegment = async (request: FastifyRequest<{ Params: { projectId: string; id: string } }>, reply: FastifyReply) => {
        const success = await this.segmentService.deleteSegment(request.params.id);
        if (!success) return reply.code(404).send({ error: "Segment not found" });
        return reply.code(204).send();
    };
}
