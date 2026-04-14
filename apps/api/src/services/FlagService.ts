import { Repository } from "typeorm";
import { Flag } from "../entities/Flag";
import { Project } from "../entities/Project";

export class FlagService {
    constructor(private readonly flagRepo: Repository<Flag>) { }

    async createFlag(project: Project, key: string, type = "boolean", description?: string): Promise<Flag> {
        if (!key || key.trim().length < 3) throw new Error("Flag key must be at least 3 characters");
        if (!/^[a-z0-9-]+$/.test(key)) throw new Error("Flag key can only contain lowercase letters, numbers, and hyphens");
        const validTypes = ["boolean", "string", "number", "json"];
        if (!validTypes.includes(type)) throw new Error(`Invalid flag type. Must be: ${validTypes.join(", ")}`);
        return this.flagRepo.save(this.flagRepo.create({ project, key: key.trim(), type, description }));
    }

    async listFlags(projectId: string): Promise<Flag[]> {
        return this.flagRepo.find({ where: { project: { id: projectId } } });
    }

    async getFlag(id: string): Promise<Flag | null> {
        return this.flagRepo.findOne({ where: { id }, relations: ["project"] });
    }

    async updateFlag(id: string, updates: { description?: string; type?: string }): Promise<Flag> {
        const flag = await this.flagRepo.findOne({ where: { id }, relations: ["project"] });
        if (!flag) throw new Error("Flag not found");
        if (updates.type !== undefined) {
            const validTypes = ["boolean", "string", "number", "json"];
            if (!validTypes.includes(updates.type)) throw new Error(`Invalid type. Must be: ${validTypes.join(", ")}`);
            flag.type = updates.type;
        }
        if (updates.description !== undefined) flag.description = updates.description;
        return this.flagRepo.save(flag);
    }

    async deleteFlag(id: string): Promise<boolean> {
        const result = await this.flagRepo.delete(id);
        return (result.affected || 0) > 0;
    }
}
