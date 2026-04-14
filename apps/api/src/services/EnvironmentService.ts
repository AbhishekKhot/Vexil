import { Repository } from "typeorm";
import { Environment } from "../entities/Environment";
import { Project } from "../entities/Project";
import crypto from "crypto";
import Redis from "ioredis";

export class EnvironmentService {
    constructor(private readonly envRepo: Repository<Environment>, private readonly redis: Redis) { }

    async createEnvironment(project: Project, name: string): Promise<Environment> {
        if (!name || name.trim().length < 2) throw new Error("Environment name must be at least 2 characters");
        const apiKey = `vex_${crypto.randomBytes(24).toString("hex")}`;
        return this.envRepo.save(this.envRepo.create({ project, name: name.trim(), apiKey }));
    }

    async listEnvironments(projectId: string): Promise<Environment[]> {
        return this.envRepo.find({ where: { project: { id: projectId } } });
    }

    async getEnvironment(id: string): Promise<Environment | null> {
        return this.envRepo.findOne({ where: { id }, relations: ["project"] });
    }

    async deleteEnvironment(id: string): Promise<boolean> {
        const env = await this.getEnvironment(id);
        if (!env) return false;
        const result = await this.envRepo.delete(id);
        if ((result.affected || 0) > 0) {
            this.redis.del(`env_apikey:${env.apiKey}`).catch(() => { });
            this.redis.del(`env_configs:${id}`).catch(() => { });
        }
        return (result.affected || 0) > 0;
    }

    async rotateApiKey(id: string): Promise<Environment> {
        const env = await this.getEnvironment(id);
        if (!env) throw new Error("Environment not found");
        const oldKey = env.apiKey;
        env.apiKey = `vex_${crypto.randomBytes(24).toString("hex")}`;
        const updated = await this.envRepo.save(env);
        this.redis.del(`env_apikey:${oldKey}`).catch(() => { });
        this.redis.del(`env_configs:${id}`).catch(() => { });
        return updated;
    }
}
