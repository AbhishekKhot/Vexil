import { Repository } from "typeorm";
import { Segment } from "../entities/Segment";
import { Project } from "../entities/Project";

export class SegmentService {
    constructor(private segmentRepo: Repository<Segment>) {}

    async createSegment(project: Project, name: string, rules: any, description?: string): Promise<Segment> {
        if (!name || name.trim().length < 2) {
            throw new Error("Segment name must be at least 2 characters");
        }

        if (!rules || typeof rules !== 'object') {
            throw new Error("Segment must have valid targeting rules");
        }

        const segment = this.segmentRepo.create({
            project,
            name: name.trim(),
            description,
            rules
        });

        return await this.segmentRepo.save(segment);
    }

    async listSegments(projectId: string): Promise<Segment[]> {
        return await this.segmentRepo.find({
            where: { project: { id: projectId } }
        });
    }

    async getSegment(id: string): Promise<Segment | null> {
        return await this.segmentRepo.findOne({
            where: { id },
            relations: ["project"]
        });
    }

    async updateSegment(id: string, updates: { name?: string; description?: string; rules?: any }): Promise<Segment> {
        const segment = await this.segmentRepo.findOne({ where: { id }, relations: ["project"] });
        if (!segment) throw new Error("Segment not found");

        if (updates.name !== undefined) {
            if (updates.name.trim().length < 2) throw new Error("Segment name must be at least 2 characters");
            segment.name = updates.name.trim();
        }

        if (updates.description !== undefined) {
            segment.description = updates.description;
        }

        if (updates.rules !== undefined) {
            if (!updates.rules || typeof updates.rules !== "object") {
                throw new Error("Segment must have valid targeting rules");
            }
            segment.rules = updates.rules;
        }

        return await this.segmentRepo.save(segment);
    }

    async deleteSegment(id: string): Promise<boolean> {
        const result = await this.segmentRepo.delete(id);
        return (result.affected || 0) > 0;
    }
}
