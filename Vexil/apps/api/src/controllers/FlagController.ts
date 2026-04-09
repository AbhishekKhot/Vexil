import { FastifyRequest, FastifyReply } from "fastify";
import { FlagService } from "../services/FlagService";
import { ProjectService } from "../services/ProjectService";

export class FlagController {
    constructor(private readonly flagService: FlagService, private readonly projectService: ProjectService) {}

    createFlag = async (request: FastifyRequest<{ Params: { projectId: string }; Body: { key: string; type?: string; description?: string } }>, reply: FastifyReply) => {
        try {
            // H7: Pass organizationId so getProject validates org ownership — prevents creating
            // flags in projects that belong to a different org.
            const project = await this.projectService.getProject(request.params.projectId, request.user.organizationId);
            if (!project) return reply.code(404).send({ error: "Project not found" });
            const flag = await this.flagService.createFlag(project, request.body?.key, request.body?.type, request.body?.description);
            return reply.code(201).send(flag);
        } catch (err: any) { return reply.code(400).send({ error: err.message }); }
    };

    listFlags = async (request: FastifyRequest<{ Params: { projectId: string } }>, reply: FastifyReply) => {
        const project = await this.projectService.getProject(request.params.projectId, request.user.organizationId);
        if (!project) return reply.code(404).send({ error: "Project not found" });
        return reply.code(200).send(await this.flagService.listFlags(project.id));
    };

    getFlag = async (request: FastifyRequest<{ Params: { projectId: string; flagId: string } }>, reply: FastifyReply) => {
        const flag = await this.flagService.getFlag(request.params.flagId);
        if (!flag || flag.project.id !== request.params.projectId) return reply.code(404).send({ error: "Flag not found" });
        return reply.code(200).send(flag);
    };

    updateFlag = async (request: FastifyRequest<{ Params: { projectId: string; flagId: string }; Body: { description?: string; type?: string } }>, reply: FastifyReply) => {
        try {
            const flag = await this.flagService.getFlag(request.params.flagId);
            if (!flag || flag.project.id !== request.params.projectId) return reply.code(404).send({ error: "Flag not found" });
            return reply.code(200).send(await this.flagService.updateFlag(request.params.flagId, request.body));
        } catch (err: any) { return reply.code(400).send({ error: err.message }); }
    };

    deleteFlag = async (request: FastifyRequest<{ Params: { projectId: string; id: string } }>, reply: FastifyReply) => {
        // H7: Verify the flag belongs to this project (and thus this org) before deleting.
        const flag = await this.flagService.getFlag(request.params.id);
        if (!flag || flag.project.id !== request.params.projectId) return reply.code(404).send({ error: "Flag not found" });
        const success = await this.flagService.deleteFlag(request.params.id);
        if (!success) return reply.code(404).send({ error: "Flag not found" });
        return reply.code(204).send();
    };
}
