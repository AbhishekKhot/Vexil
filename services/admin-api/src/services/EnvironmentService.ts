import { Repository } from "typeorm";
import { Environment } from "../entities/Environment";
import { Project } from "../entities/Project";
import crypto from "crypto";
import Redis from "ioredis";

export class EnvironmentService {
    constructor(
        private environmentRepository: Repository<Environment>,
        private redisClient: Redis
    ) {}

    async createEnvironment(project: Project, name: string): Promise<Environment> {
        if (!name || name.trim().length < 2) {
            throw new Error("Environment name must be at least 2 characters");
        }

        const apiKey = `vex_${crypto.randomBytes(24).toString('hex')}`;

        const environment = this.environmentRepository.create({
            project,
            name: name.trim(),
            apiKey,
        });

        return await this.environmentRepository.save(environment);
    }

    async listEnvironments(projectId: string): Promise<Environment[]> {
        return await this.environmentRepository.find({
            where: { project: { id: projectId } }
        });
    }

    async deleteEnvironment(id: string): Promise<boolean> {
        const env = await this.getEnvironment(id);
        if (!env) return false;

        const result = await this.environmentRepository.delete(id);
        
        if ((result.affected || 0) > 0 && this.redisClient) {
            try {
                await this.redisClient.del(`env_apikey:${env.apiKey}`);
                await this.redisClient.del(`env_configs:${id}`);
            } catch (e) {
                console.error("Failed to invalidate cache", e);
            }
        }

        return (result.affected || 0) > 0;
    }

    async rotateApiKey(id: string): Promise<Environment> {
        const env = await this.getEnvironment(id);
        if (!env) throw new Error("Environment not found");

        const oldApiKey = env.apiKey;
        env.apiKey = `vex_${crypto.randomBytes(24).toString("hex")}`;
        const updated = await this.environmentRepository.save(env);

        // Invalidate old and new cache entries
        if (this.redisClient) {
            try {
                await this.redisClient.del(`env_apikey:${oldApiKey}`);
                await this.redisClient.del(`env_configs:${id}`);
            } catch (e) {
                console.error("Failed to invalidate cache on key rotation", e);
            }
        }

        return updated;
    }

    async getEnvironment(id: string): Promise<Environment | null> {
        return await this.environmentRepository.findOne({
            where: { id },
            relations: ["project"]
        });
    }
}
