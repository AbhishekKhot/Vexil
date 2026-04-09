import { Repository } from "typeorm";
import { Environment } from "../entities/Environment";
import { EvaluationEvent } from "../entities/EvaluationEvent";

export class AnalyticsService {
    constructor(private readonly envRepo: Repository<Environment>, private readonly eventRepo: Repository<EvaluationEvent>) {}

    async ingestEvents(apiKey: string, events: { flagKey: string; result: boolean; context?: unknown; timestamp?: string }[]): Promise<boolean> {
        const env = await this.envRepo.findOne({ where: { apiKey } });
        if (!env) throw new Error("Invalid API Key");
        if (!Array.isArray(events) || events.length === 0) return false;
        const rows = events.map(e => ({ environmentId: env.id, flagKey: e.flagKey, result: e.result, context: e.context || null, evaluatedAt: e.timestamp ? new Date(e.timestamp) : new Date() }));
        await this.eventRepo.insert(rows as any).catch(() => {});
        return true;
    }

    async getAnalytics(projectId: string, environmentId?: string, flagKey?: string) {
        const query = this.eventRepo.createQueryBuilder("event")
            .innerJoin(Environment, "env", "env.id = CAST(event.environmentId AS UUID)")
            .select("event.flagKey", "flagKey")
            .addSelect("CAST(COUNT(event.id) AS INTEGER)", "evaluations")
            .addSelect("CAST(COALESCE(SUM(CASE WHEN event.result = true THEN 1 ELSE 0 END), 0) AS INTEGER)", "enabled")
            .addSelect("CAST(COALESCE(SUM(CASE WHEN event.result = false OR event.result IS NULL THEN 1 ELSE 0 END), 0) AS INTEGER)", "disabled")
            .addSelect("CAST(COALESCE(ROUND(CAST(SUM(CASE WHEN event.result = true THEN 1 ELSE 0 END) AS NUMERIC) / NULLIF(COUNT(event.id), 0) * 100, 2), 0) AS NUMERIC)", "passRate")
            .where("env.projectId = :projectId", { projectId });

        if (environmentId) query.andWhere("event.environmentId = :environmentId", { environmentId });
        if (flagKey) query.andWhere("event.flagKey = :flagKey", { flagKey });

        const results = await query.groupBy("event.flagKey").getRawMany();
        return results.map(r => ({ flagKey: r.flagKey, evaluations: Number(r.evaluations || 0), enabled: Number(r.enabled || 0), disabled: Number(r.disabled || 0), passRate: Number(r.passRate || 0) }));
    }
}
