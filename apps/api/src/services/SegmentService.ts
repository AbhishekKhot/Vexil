import { Repository } from "typeorm";
import { Segment } from "../entities/Segment";
import { Project } from "../entities/Project";

export class SegmentService {
    constructor(private readonly segmentRepo: Repository<Segment>) { }

    async createSegment(project: Project, name: string, rules: unknown, description?: string): Promise<Segment> {
        if (!name || name.trim().length < 2) throw new Error("Segment name must be at least 2 characters");
        if (!rules || typeof rules !== "object") throw new Error("Segment must have valid targeting rules");
        return this.segmentRepo.save(this.segmentRepo.create({ project, name: name.trim(), description, rules }));
    }

    async listSegments(projectId: string): Promise<Segment[]> {
        return this.segmentRepo.find({ where: { project: { id: projectId } } });
    }

    async getSegment(id: string): Promise<Segment | null> {
        return this.segmentRepo.findOne({ where: { id }, relations: ["project"] });
    }

    async updateSegment(id: string, updates: { name?: string; description?: string; rules?: unknown }): Promise<Segment> {
        const segment = await this.segmentRepo.findOne({ where: { id }, relations: ["project"] });
        if (!segment) throw new Error("Segment not found");
        if (updates.name !== undefined) { if (updates.name.trim().length < 2) throw new Error("Segment name must be at least 2 characters"); segment.name = updates.name.trim(); }
        if (updates.description !== undefined) segment.description = updates.description;
        if (updates.rules !== undefined) { if (!updates.rules || typeof updates.rules !== "object") throw new Error("Invalid rules"); segment.rules = updates.rules; }
        return this.segmentRepo.save(segment);
    }

    async deleteSegment(id: string): Promise<boolean> {
        const result = await this.segmentRepo.delete(id);
        return (result.affected || 0) > 0;
    }
}
