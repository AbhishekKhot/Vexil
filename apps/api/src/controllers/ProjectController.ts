import { FastifyRequest, FastifyReply } from "fastify";
import { ProjectService } from "../services/ProjectService";

export class ProjectController {
    constructor(private readonly projectService: ProjectService) {}

    createProject = async (request: FastifyRequest<{ Body: { name: string; description?: string } }>, reply: FastifyReply) => {
        try {
            const project = await this.projectService.createProject(request.user.organizationId, request.body?.name, request.body?.description);
            return reply.code(201).send(project);
        } catch (err: any) { return reply.code(400).send({ error: err.message }); }
    };

    listProjects = async (request: FastifyRequest, reply: FastifyReply) => {
        const projects = await this.projectService.listProjects(request.user.organizationId);
        return reply.code(200).send(projects);
    };

    getProject = async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
        const project = await this.projectService.getProject(request.params.id, request.user.organizationId);
        if (!project) return reply.code(404).send({ error: "Project not found" });
        return reply.code(200).send(project);
    };

    deleteProject = async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
        try {
            const success = await this.projectService.deleteProject(request.params.id, request.user.organizationId);
            if (!success) return reply.code(404).send({ error: "Project not found" });
            return reply.code(204).send();
        } catch (err: any) { return reply.code(500).send({ error: "Internal Server Error" }); }
    };
}
