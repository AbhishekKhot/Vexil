import { FastifyRequest, FastifyReply } from "fastify";
import { EnvironmentService } from "../services/EnvironmentService";
import { ProjectService } from "../services/ProjectService";

export class EnvironmentController {
    constructor(
        private readonly environmentService: EnvironmentService,
        private readonly projectService: ProjectService
    ) {}

    createEnvironment = async (
        request: FastifyRequest<{ Params: { projectId: string }, Body: { name: string } }>, 
        reply: FastifyReply
    ) => {
        try {
            const project = await this.projectService.getProject(request.params.projectId);
            if (!project) {
                return reply.code(404).send({ error: "Project not found" });
            }

            const environment = await this.environmentService.createEnvironment(project, request.body?.name);
            return reply.code(201).send(environment);
        } catch (error: any) {
            return reply.code(400).send({ error: error.message });
        }
    };

    listEnvironments = async (
        request: FastifyRequest<{ Params: { projectId: string } }>, 
        reply: FastifyReply
    ) => {
        try {
            const project = await this.projectService.getProject(request.params.projectId);
            if (!project) {
                return reply.code(404).send({ error: "Project not found" });
            }

            const environments = await this.environmentService.listEnvironments(project.id);
            return reply.code(200).send(environments);
        } catch (error: any) {
            return reply.code(500).send({ error: "Internal Server Error" });
        }
    };
}
