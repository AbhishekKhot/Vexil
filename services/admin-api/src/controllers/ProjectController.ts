import { FastifyRequest, FastifyReply } from "fastify";
import { ProjectService } from "../services/ProjectService";
import { Repository } from "typeorm";
import { Project } from "../entities/Project";
import { AuditLogService } from "../services/AuditLogService";

export class ProjectController {
    constructor(
        private readonly projectService: ProjectService,
        private readonly auditLogService: AuditLogService
    ) {}

    createProject = async (request: FastifyRequest<{ Body: { name: string, description?: string } }>, reply: FastifyReply) => {
        try {
            const project = await this.projectService.createProject(request.user.organizationId, request.body?.name, request.body?.description);
            
            await this.auditLogService.log({
                entityType: "project",
                entityId: project.id,
                action: "created",
                actorId: request.user.id,
                actorEmail: request.user.email,
                newValue: { ...project },
                metadata: {
                    projectId: project.id,
                    projectName: project.name
                }
            });

            reply.code(201).send(project);
        } catch (error: any) {
            reply.code(400).send({ error: error.message });
        }
    };

    deleteProject = async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
        try {
            const project = await this.projectService.getProject(request.params.id, request.user.organizationId);
            if (!project) {
                reply.code(404).send({ error: "Project not found" });
                return;
            }

            const success = await this.projectService.deleteProject(request.params.id, request.user.organizationId);
            if (!success) {
                reply.code(404).send({ error: "Project not found" });
                return;
            }

            await this.auditLogService.log({
                entityType: "project",
                entityId: project.id,
                action: "deleted",
                actorId: request.user.id,
                actorEmail: request.user.email,
                previousValue: { ...project },
                metadata: {
                    projectId: project.id,
                    projectName: project.name
                }
            });

            reply.code(204).send();
        } catch (error: any) {
            reply.code(500).send({ error: "Internal server error" });
        }
    };

    listProjects = async (request: FastifyRequest, reply: FastifyReply) => {
        const projects = await this.projectService.listProjects(request.user.organizationId);
        reply.code(200).send(projects);
    };

    getProject = async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
        try {
            const project = await this.projectService.getProject(request.params.id, request.user.organizationId);
            if (!project) {
                reply.code(404).send({ error: "Project not found" });
                return;
            }
            reply.code(200).send(project);
        } catch (error: any) {
            reply.code(404).send({ error: "Project not found" });
        }
    };
}
