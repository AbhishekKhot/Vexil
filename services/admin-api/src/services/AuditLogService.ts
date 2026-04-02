import { Repository } from "typeorm";
import { AuditLog } from "../entities/AuditLog";

export interface CreateAuditLogParams {
    entityType: string;
    entityId: string;
    action: string;
    actorId?: string;
    actorEmail?: string;
    previousValue?: Record<string, unknown> | null;
    newValue?: Record<string, unknown> | null;
    metadata?: Record<string, unknown>;
}

export class AuditLogService {
    constructor(private readonly auditLogRepo: Repository<AuditLog>) {}

    async log(params: CreateAuditLogParams): Promise<AuditLog> {
        const auditLog = this.auditLogRepo.create({
            ...params,
            previousValue: params.previousValue || undefined,
            newValue: params.newValue || undefined,
        });
        return await this.auditLogRepo.save(auditLog);
    }
    
    async getLogs(projectId: string, query: { page?: number; limit?: number; entityType?: string; action?: string } = {}) {
        const page = query.page || 1;
        const limit = query.limit || 20;
        const skip = (page - 1) * limit;

        const qb = this.auditLogRepo.createQueryBuilder("log");
        qb.where("log.metadata ->> 'projectId' = :projectId", { projectId });
        
        if (query.entityType) {
            qb.andWhere("log.entityType = :entityType", { entityType: query.entityType });
        }
        if (query.action) {
            qb.andWhere("log.action = :action", { action: query.action });
        }
        
        qb.orderBy("log.createdAt", "DESC");
        qb.skip(skip).take(limit);

        const [items, total] = await qb.getManyAndCount();
        return { items, total, page, limit };
    }
    
    async getLogById(id: string) {
        return await this.auditLogRepo.findOne({ where: { id } });
    }
}
