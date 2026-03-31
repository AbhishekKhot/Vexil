import { Repository } from "typeorm";
import { Environment } from "../entities/Environment";

export class AnalyticsService {
    constructor(
        private environmentRepo: Repository<Environment>,
        private publishFn: (payload: any) => Promise<boolean>
    ) {}

    async ingestEvents(apiKey: string, events: any[]): Promise<boolean> {
        // Valdiate SDK key exists
        const environment = await this.environmentRepo.findOne({
            where: { apiKey }
        });

        if (!environment) {
            throw new Error("Invalid API Key");
        }

        if (!Array.isArray(events) || events.length === 0) {
            return false;
        }

        // Add server-side timestamp and environment binding
        const payload = {
            environmentId: environment.id,
            ingestedAt: new Date().toISOString(),
            events
        };

        // Publish to queue asynchronously
        return await this.publishFn(payload);
    }
}
