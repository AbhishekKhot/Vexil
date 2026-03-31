import { Repository } from "typeorm";
import { FlagEnvironmentConfig } from "../entities/FlagEnvironmentConfig";
import { Flag } from "../entities/Flag";
import { Environment } from "../entities/Environment";

export class FlagConfigService {
    constructor(private configRepo: Repository<FlagEnvironmentConfig>) {}

    async getFlagConfig(flagId: string, environmentId: string): Promise<FlagEnvironmentConfig | null> {
        return await this.configRepo.findOne({
            where: { flag: { id: flagId }, environment: { id: environmentId } },
            relations: ["flag", "environment"]
        });
    }

    async setFlagConfig(
        flag: Flag, 
        environment: Environment, 
        isEnabled: boolean,
        rules?: any
    ): Promise<FlagEnvironmentConfig> {
        let config = await this.getFlagConfig(flag.id, environment.id);

        if (!config) {
            config = this.configRepo.create({
                flag,
                environment,
                isEnabled,
                rules
            });
        } else {
            config.isEnabled = isEnabled;
            if (rules !== undefined) {
                config.rules = rules;
            }
        }

        return await this.configRepo.save(config);
    }
}
