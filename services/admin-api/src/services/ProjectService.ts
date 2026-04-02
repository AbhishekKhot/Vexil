import { Repository } from "typeorm";
import { Project } from "../entities/Project";

export class ProjectService {
    constructor(private readonly projectRepository: Repository<Project>) {}

    async createProject(organizationId: string, name: string, description?: string): Promise<Project> {
        if (!name || name.trim().length < 3) {
            throw new Error("Project name must be at least 3 characters");
        }
        const project = this.projectRepository.create({ 
            organizationId,
            name: name.trim(),
            description: description?.trim()
        });
        return this.projectRepository.save(project);
    }

    async deleteProject(id: string, organizationId: string): Promise<boolean> {
        const result = await this.projectRepository.delete({ id, organizationId });
        return (result.affected || 0) > 0;
    }

    async getProject(id: string, organizationId?: string): Promise<Project | null> {
        const where: any = { id };
        if (organizationId) {
            where.organizationId = organizationId;
        }
        return this.projectRepository.findOne({ where });
    }

    async listProjects(organizationId: string): Promise<Project[]> {
        return this.projectRepository.find({ 
            where: { organizationId },
            order: { createdAt: "DESC" } 
        });
    }
}
