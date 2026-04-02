import { FastifyRequest, FastifyReply } from "fastify";
import { FlagConfigService } from "../services/FlagConfigService";
import { FlagService } from "../services/FlagService";
import { EnvironmentService } from "../services/EnvironmentService";
import { AuditLogService } from "../services/AuditLogService";
import { StrategyValidationError } from "../evaluation/EvaluationStrategy.interface";

interface SetFlagConfigBody {
    isEnabled: boolean;
    strategyType?: string;
    strategyConfig?: Record<string, unknown>;
    /** @deprecated */
    rules?: unknown;
    scheduledAt?: string | null;
    scheduledConfig?: Record<string, unknown> | null;
}

export class FlagConfigController {
    constructor(
        private readonly flagConfigService: FlagConfigService,
        private readonly flagService: FlagService,
        private readonly environmentService: EnvironmentService,
        private readonly auditLogService: AuditLogService
    ) {}

    getFlagConfig = async (
        request: FastifyRequest<{ Params: { projectId: string; environmentId: string; flagId: string } }>,
        reply: FastifyReply
    ) => {
        try {
            const { environmentId, flagId } = request.params;
            const config = await this.flagConfigService.getFlagConfig(flagId, environmentId);
            if (!config) {
                return reply.code(404).send({ error: "Flag configuration not found for this environment" });
            }
            return reply.code(200).send(config);
        } catch {
            return reply.code(500).send({ error: "Internal Server Error" });
        }
    };

    setFlagConfig = async (
        request: FastifyRequest<{
            Params: { projectId: string; environmentId: string; flagId: string };
            Body: SetFlagConfigBody;
        }>,
        reply: FastifyReply
    ) => {
        const { projectId, environmentId, flagId } = request.params;
        const { isEnabled, strategyType, strategyConfig, rules, scheduledAt, scheduledConfig } = request.body;

        if (typeof isEnabled !== "boolean") {
            return reply.code(400).send({ error: "isEnabled must be a boolean" });
        }

        try {
            const [flag, environment] = await Promise.all([
                this.flagService.getFlag(flagId),
                this.environmentService.getEnvironment(environmentId),
            ]);

            if (!flag)        return reply.code(404).send({ error: "Flag not found" });
            if (!environment) return reply.code(404).send({ error: "Environment not found" });

            const oldConfig = await this.flagConfigService.getFlagConfig(flagId, environmentId);

            const config = await this.flagConfigService.setFlagConfig({
                flag,
                environment,
                isEnabled,
                strategyType,
                strategyConfig,
                rules,
                scheduledAt,
                scheduledConfig,
            });

            await this.auditLogService.log({
                entityType: "flag_config",
                entityId: config.id,
                action: "updated",
                actorId: request.user.id,
                actorEmail: request.user.email,
                previousValue: oldConfig ? { ...oldConfig, flag: undefined, environment: undefined } : null,
                newValue: { ...config, flag: undefined, environment: undefined },
                metadata: {
                    projectId,
                    environmentId,
                    environmentName: environment.name,
                    flagId,
                    flagKey: flag.key
                }
            });

            return reply.code(200).send(config);
        } catch (err) {
            if (err instanceof StrategyValidationError) {
                return reply.code(400).send({ error: err.message });
            }
            return reply.code(400).send({ error: err instanceof Error ? err.message : "Bad Request" });
        }
    };
}
