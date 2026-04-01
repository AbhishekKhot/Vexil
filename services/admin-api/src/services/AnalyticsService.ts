import { Repository } from "typeorm";
import { Environment } from "../entities/Environment";
import { EvaluationEvent } from "../entities/EvaluationEvent";

export class AnalyticsService {
    constructor(
        private environmentRepo: Repository<Environment>,
        private eventRepo: Repository<EvaluationEvent>,
        private publishFn: (payload: any) => Promise<boolean>
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
        // This is a simplified query; in a real app, we'd use more sophisticated aggregation.
        const query = this.eventRepo.createQueryBuilder("event")
            .select("event.flagKey", "flagKey")
            .addSelect("COUNT(event.id)", "count")
            .addSelect("SUM(CASE WHEN event.result = true THEN 1 ELSE 0 END)", "enabledCount")
            .where("1=1");

        if (environmentId) {
            query.andWhere("event.environmentId = :environmentId", { environmentId });
        }

        if (flagKey) {
            query.andWhere("event.flagKey = :flagKey", { flagKey });
        }

        return await query.groupBy("event.flagKey").getRawMany();
    }
}
