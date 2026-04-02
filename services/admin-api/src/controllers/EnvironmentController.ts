import { FastifyRequest, FastifyReply } from "fastify";
import { EnvironmentService } from "../services/EnvironmentService";
import { ProjectService } from "../services/ProjectService";
import { AuditLogService } from "../services/AuditLogService";

export class EnvironmentController {
    constructor(
        private readonly environmentService: EnvironmentService,
        private readonly projectService: ProjectService,
        private readonly auditLogService: AuditLogService
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

            await this.auditLogService.log({
                entityType: "environment",
                entityId: environment.id,
                action: "created",
                newValue: { ...environment, project: undefined },
                metadata: {
                    projectId: project.id,
                    projectName: project.name,
                    environmentName: environment.name
                }
            });

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

    deleteEnvironment = async (
        request: FastifyRequest<{ Params: { projectId: string, id: string } }>, 
        reply: FastifyReply
    ) => {
        try {
            // Get environment first to audit log it
            const project = await this.projectService.getProject(request.params.projectId);
            const environments = await this.environmentService.listEnvironments(request.params.projectId);
            const environment = environments.find(e => e.id === request.params.id);
            if (!environment || !project) {
                return reply.code(404).send({ error: "Environment not found" });
            }

            const success = await this.environmentService.deleteEnvironment(request.params.id);
            if (!success) {
                return reply.code(404).send({ error: "Environment not found" });
            }

            await this.auditLogService.log({
                entityType: "environment",
                entityId: environment.id,
                action: "deleted",
                actorId: (request as any).user.id,
                actorEmail: (request as any).user.email,
                previousValue: { ...environment, project: undefined },
                metadata: {
                    projectId: project.id,
                    projectName: project.name,
                    environmentName: environment.name
                }
            });

            return reply.code(204).send();
        } catch (error: any) {
            return reply.code(500).send({ error: "Internal Server Error" });
        }
    };
}
