import { FastifyRequest, FastifyReply } from "fastify";
import { FlagService } from "../services/FlagService";
import { ProjectService } from "../services/ProjectService";

export class FlagController {
    constructor(
        private readonly flagService: FlagService,
        private readonly projectService: ProjectService
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
        request: FastifyRequest<{ Params: { id: string } }>, 
        reply: FastifyReply
    ) => {
        try {
            const success = await this.flagService.deleteFlag(request.params.id);
            if (!success) {
                return reply.code(404).send({ error: "Flag not found" });
            }
            return reply.code(204).send();
        } catch (error: any) {
            return reply.code(500).send({ error: "Internal Server Error" });
        }
    };
}
