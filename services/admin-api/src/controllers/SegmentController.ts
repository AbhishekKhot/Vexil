import { FastifyRequest, FastifyReply } from "fastify";
import { SegmentService } from "../services/SegmentService";
import { ProjectService } from "../services/ProjectService";
import { AuditLogService } from "../services/AuditLogService";

export class SegmentController {
    constructor(
        private readonly segmentService: SegmentService,
        private readonly projectService: ProjectService,
        private readonly auditLogService: AuditLogService
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

            await this.auditLogService.log({
                entityType: "segment",
                entityId: segment.id,
                action: "created",
                actorId: (request as any).user.id,
                actorEmail: (request as any).user.email,
                newValue: { ...segment, project: undefined },
                metadata: {
                    projectId: project.id,
                    projectName: project.name,
                    segmentName: segment.name
                }
            });

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

            await this.auditLogService.log({
                entityType: "segment",
                entityId: updated.id,
                action: "updated",
                actorId: (request as any).user.id,
                actorEmail: (request as any).user.email,
                previousValue: { name: segment.name, description: segment.description, rules: segment.rules },
                newValue: { name: updated.name, description: updated.description, rules: updated.rules },
                metadata: { projectId: request.params.projectId, segmentName: updated.name }
            });

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

            await this.auditLogService.log({
                entityType: "segment",
                entityId: segment.id,
                action: "deleted",
                previousValue: { ...segment, project: undefined },
                metadata: {
                    projectId: request.params.projectId,
                    segmentName: segment.name
                }
            });

            return reply.code(204).send();
        } catch (error: any) {
            return reply.code(500).send({ error: "Internal Server Error" });
        }
    };
}
