import { Repository } from "typeorm";
import { Project } from "../entities/Project";

export class ProjectService {
    constructor(private readonly projectRepository: Repository<Project>) {}

    async createProject(name: string, description?: string): Promise<Project> {
        if (!name || name.trim().length < 3) {
            throw new Error("Project name must be at least 3 characters");
        }
        const project = this.projectRepository.create({ 
            name: name.trim(),
            description: description?.trim()
        });
        return this.projectRepository.save(project);
    }

    async deleteProject(id: string): Promise<boolean> {
        const result = await this.projectRepository.delete(id);
        return (result.affected || 0) > 0;
    }

    async getProject(id: string): Promise<Project | null> {
        return this.projectRepository.findOne({ where: { id } });
    }

    async listProjects(): Promise<Project[]> {
        return this.projectRepository.find({ order: { createdAt: "DESC" } });
    }
}
