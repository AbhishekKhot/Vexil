import { Repository } from "typeorm";
import { Project } from "../entities/Project";

export class ProjectService {
    constructor(private readonly projectRepo: Repository<Project>) {}

    async createProject(organizationId: string, name: string, description?: string): Promise<Project> {
        if (!name || name.trim().length < 3) throw new Error("Project name must be at least 3 characters");
        return this.projectRepo.save(this.projectRepo.create({ organizationId, name: name.trim(), description: description?.trim() }));
    }

    async listProjects(organizationId: string): Promise<Project[]> {
        return this.projectRepo.find({ where: { organizationId }, order: { createdAt: "DESC" } });
    }

    async getProject(id: string, organizationId?: string): Promise<Project | null> {
        const where: Record<string, unknown> = { id };
        if (organizationId) where.organizationId = organizationId;
        return this.projectRepo.findOne({ where: where as any });
    }

    async deleteProject(id: string, organizationId: string): Promise<boolean> {
        const result = await this.projectRepo.delete({ id, organizationId });
        return (result.affected || 0) > 0;
    }
}
