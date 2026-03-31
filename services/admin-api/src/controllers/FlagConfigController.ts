import { FastifyRequest, FastifyReply } from "fastify";
import { FlagConfigService } from "../services/FlagConfigService";
import { FlagService } from "../services/FlagService";
import { EnvironmentService } from "../services/EnvironmentService";

export class FlagConfigController {
    constructor(
        private readonly flagConfigService: FlagConfigService,
        private readonly flagService: FlagService,
        private readonly environmentService: EnvironmentService
    ) {}

    getFlagConfig = async (
        request: FastifyRequest<{ Params: { projectId: string, environmentId: string, flagId: string } }>, 
        reply: FastifyReply
    ) => {
        try {
            const { environmentId, flagId } = request.params;
            const config = await this.flagConfigService.getFlagConfig(flagId, environmentId);
            
            if (!config) {
                return reply.code(404).send({ error: "Flag Configuration not found for this environment" });
            }

            return reply.code(200).send(config);
        } catch (error: any) {
            return reply.code(500).send({ error: "Internal Server Error" });
        }
    };

    setFlagConfig = async (
        request: FastifyRequest<{ Params: { projectId: string, environmentId: string, flagId: string }, Body: { isEnabled: boolean, rules?: any } }>, 
        reply: FastifyReply
    ) => {
        try {
            const { environmentId, flagId } = request.params;
            const { isEnabled, rules } = request.body;
            
            const flag = await this.flagService.getFlag(flagId);
            if (!flag) return reply.code(404).send({ error: "Flag not found" });

            const environment = await this.environmentService.getEnvironment(environmentId);
            if (!environment) return reply.code(404).send({ error: "Environment not found" });

            const config = await this.flagConfigService.setFlagConfig(
                flag, 
                environment,
                isEnabled,
                rules
            );
            return reply.code(200).send(config);
        } catch (error: any) {
            return reply.code(400).send({ error: error.message });
        }
    };
}
