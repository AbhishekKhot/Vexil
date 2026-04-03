import { Repository } from "typeorm";
import { Environment } from "../entities/Environment";
import { EvaluationEvent } from "../entities/EvaluationEvent";
import { Project } from "../entities/Project";

export class AnalyticsService {
    constructor(
        private environmentRepo: Repository<Environment>,
        private eventRepo: Repository<EvaluationEvent>,
        private publishFn: (payload: any) => Promise<boolean>,
        private projectRepo?: Repository<Project>
    ) {}

    async ingestEvents(apiKey: string, events: any[]): Promise<boolean> {
        // Validate SDK key exists
        const environment = await this.environmentRepo.findOne({
            where: { apiKey }
        });

        if (!environment) {
            throw new Error("Invalid API Key");
        }

        if (!Array.isArray(events) || events.length === 0) {
            return false;
        }

        const payload = {
            environmentId: environment.id,
            ingestedAt: new Date().toISOString(),
            events
        };

        // 1. Publish to RabbitMQ queue via provided publisher function
        await this.publishFn(payload);

        // 2. Store in PostgreSQL for Dashboard querying
        const evaluationEvents = events.map(evt => ({
            environmentId: environment.id,
            flagKey: evt.flagKey,
            result: evt.result,
            context: evt.context || null,
            evaluatedAt: evt.timestamp ? new Date(evt.timestamp) : new Date()
        }));

        await this.eventRepo.insert(evaluationEvents).catch(() => {
            console.error("Failed to insert evaluation events to DB");
        });

        return true;
    }

    async getAnalytics(projectId: string, environmentId?: string, flagKey?: string) {
        try {
            // Join event -> environment -> project so we can filter by projectId
            const query = this.eventRepo.createQueryBuilder("event")
                .innerJoin(Environment, "env", "env.id = CAST(event.environmentId AS UUID)")
                .select("event.flagKey", "flagKey")
                .addSelect("CAST(COUNT(event.id) AS INTEGER)", "evaluations")
                .addSelect("CAST(COALESCE(SUM(CASE WHEN event.result = true THEN 1 ELSE 0 END), 0) AS INTEGER)", "enabled")
                .addSelect("CAST(COALESCE(SUM(CASE WHEN event.result = false OR event.result IS NULL THEN 1 ELSE 0 END), 0) AS INTEGER)", "disabled")
                .addSelect("CAST(COALESCE(ROUND(CAST(SUM(CASE WHEN event.result = true THEN 1 ELSE 0 END) AS NUMERIC) / NULLIF(COUNT(event.id), 0) * 100, 2), 0) AS NUMERIC)", "passRate")
                .where("env.projectId = :projectId", { projectId });

            if (environmentId) {
                query.andWhere("event.environmentId = :environmentId", { environmentId });
            }

            if (flagKey) {
                query.andWhere("event.flagKey = :flagKey", { flagKey });
            }

            const results = await query.groupBy("event.flagKey").getRawMany();
            
            // Ensure numeric fields are actually numbers (not strings from PG driver)
            return results.map(r => ({
                flagKey: r.flagKey,
                evaluations: Number(r.evaluations || 0),
                enabled: Number(r.enabled || 0),
                disabled: Number(r.disabled || 0),
                passRate: Number(r.passRate || 0)
            }));
        } catch (error) {
            console.error("Error in getAnalytics:", error);
            throw error;
        }
    }
}
