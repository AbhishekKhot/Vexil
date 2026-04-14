import { Repository } from "typeorm";
import { Environment } from "../entities/Environment";
import { EvaluationEvent } from "../entities/EvaluationEvent";
import { Project } from "../entities/Project";

// Hard limits to prevent DB abuse and storage cost explosion.
const MAX_EVENTS_PER_BATCH = 500;
const MAX_CONTEXT_BYTES = 2048; // 2 KB per event context

export class AnalyticsService {
    constructor(
        private readonly envRepo: Repository<Environment>,
        private readonly eventRepo: Repository<EvaluationEvent>,
        private readonly projectRepo: Repository<Project>
    ) { }

    async ingestEvents(apiKey: string, events: { flagKey: string; result: boolean; context?: unknown; timestamp?: string }[]): Promise<boolean> {
        const env = await this.envRepo.findOne({ where: { apiKey } });
        if (!env) throw new Error("Invalid API Key");
        if (!Array.isArray(events) || events.length === 0) return false;

        // H4: Hard cap — reject oversized batches entirely.
        if (events.length > MAX_EVENTS_PER_BATCH)
            throw new Error(`Batch too large. Maximum ${MAX_EVENTS_PER_BATCH} events per request.`);

        const rows = events.map(e => {
            // H4: Validate required fields per event.
            if (typeof e.flagKey !== "string" || e.flagKey.trim().length === 0)
                throw new Error("Each event must have a non-empty flagKey string.");
            if (typeof e.result !== "boolean")
                throw new Error("Each event result must be a boolean.");

            // H4: Cap context size to prevent large-JSON storage abuse.
            let context: unknown = null;
            if (e.context != null) {
                const serialized = JSON.stringify(e.context);
                if (serialized.length <= MAX_CONTEXT_BYTES) {
                    context = e.context;
                }
                // Silently drop oversized context rather than rejecting the whole batch.
            }

            return {
                environmentId: env.id,
                flagKey: e.flagKey.trim().slice(0, 128), // also cap flagKey length
                result: e.result,
                context,
                evaluatedAt: e.timestamp ? new Date(e.timestamp) : new Date(),
            };
        });

        await this.eventRepo.insert(rows as any).catch(() => { });
        return true;
    }

    async getAnalytics(projectId: string, organizationId: string, environmentId?: string, flagKey?: string) {
        // H5: Verify the project belongs to the requesting user's org before returning data.
        const project = await this.projectRepo.findOne({ where: { id: projectId, organizationId } });
        if (!project) return []; // return empty rather than 403 to avoid leaking project existence

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
