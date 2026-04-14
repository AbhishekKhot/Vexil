import { FastifyRequest, FastifyReply } from "fastify";
import { EnvironmentService } from "../services/EnvironmentService";
import { ProjectService } from "../services/ProjectService";

export class EnvironmentController {
    constructor(private readonly envService: EnvironmentService, private readonly projectService: ProjectService) { }

    createEnvironment = async (request: FastifyRequest<{ Params: { projectId: string }; Body: { name: string } }>, reply: FastifyReply) => {
        try {
            // Pass organizationId to prevent creating environments in another org's project.
            const project = await this.projectService.getProject(request.params.projectId, request.user.organizationId);
            if (!project) return reply.code(404).send({ error: "Project not found" });
            const env = await this.envService.createEnvironment(project, request.body ?.name);
            return reply.code(201).send(env);
        } catch (err: any) { return reply.code(400).send({ error: err.message }); }
    };

    listEnvironments = async (request: FastifyRequest<{ Params: { projectId: string } }>, reply: FastifyReply) => {
        const project = await this.projectService.getProject(request.params.projectId, request.user.organizationId);
        if (!project) return reply.code(404).send({ error: "Project not found" });
        const envs = await this.envService.listEnvironments(project.id);
        return reply.code(200).send(envs);
    };

    rotateApiKey = async (request: FastifyRequest<{ Params: { projectId: string; envId: string } }>, reply: FastifyReply) => {
        try {
            const env = await this.envService.getEnvironment(request.params.envId);
            if (!env || env.project.id !== request.params.projectId) return reply.code(404).send({ error: "Environment not found" });
            const updated = await this.envService.rotateApiKey(request.params.envId);
            return reply.code(200).send({ apiKey: updated.apiKey });
        } catch (err: any) { return reply.code(500).send({ error: "Internal Server Error" }); }
    };

    deleteEnvironment = async (request: FastifyRequest<{ Params: { projectId: string; id: string } }>, reply: FastifyReply) => {
        // Verify env belongs to this project before deleting.
        const env = await this.envService.getEnvironment(request.params.id);
        if (!env || env.project.id !== request.params.projectId) return reply.code(404).send({ error: "Environment not found" });
        const success = await this.envService.deleteEnvironment(request.params.id);
        if (!success) return reply.code(404).send({ error: "Environment not found" });
        return reply.code(204).send();
    };
}
