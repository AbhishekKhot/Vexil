import { Repository } from "typeorm";
import { AuditLog } from "../entities/AuditLog";

export interface CreateAuditLogParams {
    entityType: string; entityId: string; action: string;
    actorId?: string; actorEmail?: string;
    previousValue?: Record<string, unknown> | null;
    newValue?: Record<string, unknown> | null;
    metadata?: Record<string, unknown>;
}

export class AuditLogService {
    constructor(private readonly auditLogRepo: Repository<AuditLog>) {}

    async log(params: CreateAuditLogParams): Promise<AuditLog> {
        return this.auditLogRepo.save(this.auditLogRepo.create({ ...params, previousValue: params.previousValue || undefined, newValue: params.newValue || undefined }));
    }

    async getLogs(projectId: string, query: { page?: number; limit?: number; entityType?: string; action?: string } = {}) {
        const page = query.page || 1;
        // H8: Cap limit to prevent unbounded DB queries.
        const limit = Math.min(query.limit || 20, 100);
        const qb = this.auditLogRepo.createQueryBuilder("log")
            .where("log.metadata ->> 'projectId' = :projectId", { projectId });
        if (query.entityType) qb.andWhere("log.entityType = :entityType", { entityType: query.entityType });
        if (query.action) qb.andWhere("log.action = :action", { action: query.action });
        qb.orderBy("log.createdAt", "DESC").skip((page - 1) * limit).take(limit);
        const [items, total] = await qb.getManyAndCount();
        return { items, total, page, limit };
    }

    async getLogById(id: string, projectId: string): Promise<AuditLog | null> {
        // H6: Verify the log belongs to the requested project to prevent cross-org data leakage.
        const log = await this.auditLogRepo.findOne({ where: { id } });
        if (!log) return null;
        // Logs store projectId in metadata — verify it matches the URL param.
        if ((log.metadata as any)?.projectId !== projectId) return null;
        return log;
    }
}
