import { FastifyRequest, FastifyReply } from "fastify";
import { FlagConfigService } from "../services/FlagConfigService";
import { FlagService } from "../services/FlagService";
import { EnvironmentService } from "../services/EnvironmentService";
import { StrategyValidationError } from "../evaluation/EvaluationStrategy.interface";

export class FlagConfigController {
    constructor(private readonly flagConfigService: FlagConfigService, private readonly flagService: FlagService, private readonly envService: EnvironmentService) { }

    getFlagConfig = async (request: FastifyRequest<{ Params: { projectId: string; environmentId: string; flagId: string } }>, reply: FastifyReply) => {
        const config = await this.flagConfigService.getFlagConfig(request.params.flagId, request.params.environmentId);
        if (!config) return reply.code(404).send({ error: "Flag configuration not found" });
        return reply.code(200).send(config);
    };

    setFlagConfig = async (request: FastifyRequest<{ Params: { projectId: string; environmentId: string; flagId: string }; Body: { isEnabled: boolean; strategyType?: string; strategyConfig?: Record<string, unknown>; scheduledAt?: string | null; scheduledConfig?: Record<string, unknown> | null } }>, reply: FastifyReply) => {
        const { projectId, environmentId, flagId } = request.params;
        const { isEnabled, strategyType, strategyConfig, scheduledAt, scheduledConfig } = request.body;
        if (typeof isEnabled !== "boolean") return reply.code(400).send({ error: "isEnabled must be a boolean" });
        try {
            const [flag, environment] = await Promise.all([this.flagService.getFlag(flagId), this.envService.getEnvironment(environmentId)]);
            if (!flag) return reply.code(404).send({ error: "Flag not found" });
            if (!environment) return reply.code(404).send({ error: "Environment not found" });
            const config = await this.flagConfigService.setFlagConfig({ flag, environment, isEnabled, strategyType, strategyConfig, scheduledAt, scheduledConfig });
            return reply.code(200).send(config);
        } catch (err) {
            if (err instanceof StrategyValidationError) return reply.code(400).send({ error: err.message });
            return reply.code(400).send({ error: err instanceof Error ? err.message : "Bad Request" });
        }
    };
}
