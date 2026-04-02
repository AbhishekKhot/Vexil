import { FastifyRequest, FastifyReply } from "fastify";
import { FlagService } from "../services/FlagService";
import { ProjectService } from "../services/ProjectService";
import { AuditLogService } from "../services/AuditLogService";

export class FlagController {
    constructor(
        private readonly flagService: FlagService,
        private readonly projectService: ProjectService,
        private readonly auditLogService: AuditLogService
    ) {}

    createFlag = async (
        request: FastifyRequest<{ Params: { projectId: string }, Body: { key: string, type?: string, description?: string } }>, 
        reply: FastifyReply
    ) => {
        try {
            const project = await this.projectService.getProject(request.params.projectId);
            if (!project) {
                return reply.code(404).send({ error: "Project not found" });
            }

            const flag = await this.flagService.createFlag(
                project, 
                request.body?.key,
                request.body?.type,
                request.body?.description
            );

            await this.auditLogService.log({
                entityType: "flag",
                entityId: flag.id,
                action: "created",
                actorId: (request as any).user.id,
                actorEmail: (request as any).user.email,
                newValue: { ...flag, project: undefined },
                metadata: {
                    projectId: project.id,
                    projectName: project.name,
                    flagKey: flag.key
                }
            });

            return reply.code(201).send(flag);
        } catch (error: any) {
            return reply.code(400).send({ error: error.message });
        }
    };

    listFlags = async (
        request: FastifyRequest<{ Params: { projectId: string } }>, 
        reply: FastifyReply
    ) => {
        try {
            const project = await this.projectService.getProject(request.params.projectId);
            if (!project) {
                return reply.code(404).send({ error: "Project not found" });
            }

            const flags = await this.flagService.listFlags(project.id);
            return reply.code(200).send(flags);
        } catch (error: any) {
            return reply.code(500).send({ error: "Internal Server Error" });
        }
    };
    
    getFlag = async (
        request: FastifyRequest<{ Params: { projectId: string, flagId: string } }>, 
        reply: FastifyReply
    ) => {
        try {
            const flag = await this.flagService.getFlag(request.params.flagId);
            if (!flag || flag.project.id !== request.params.projectId) {
                return reply.code(404).send({ error: "Flag not found" });
            }

            return reply.code(200).send(flag);
        } catch (error: any) {
            return reply.code(500).send({ error: "Internal Server Error" });
        }
    };

    deleteFlag = async (
        request: FastifyRequest<{ Params: { projectId: string, id: string } }>, 
        reply: FastifyReply
    ) => {
        try {
            const flag = await this.flagService.getFlag(request.params.id);
            if (!flag) {
                return reply.code(404).send({ error: "Flag not found" });
            }

            const success = await this.flagService.deleteFlag(request.params.id);
            if (!success) {
                return reply.code(404).send({ error: "Flag not found" });
            }

            await this.auditLogService.log({
                entityType: "flag",
                entityId: flag.id,
                action: "deleted",
                previousValue: { ...flag, project: undefined },
                metadata: {
                    projectId: request.params.projectId,
                    flagKey: flag.key
                }
            });

            return reply.code(204).send();
        } catch (error: any) {
            return reply.code(500).send({ error: "Internal Server Error" });
        }
    };
}
