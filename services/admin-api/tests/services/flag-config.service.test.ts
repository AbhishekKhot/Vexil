import { DataSource, Repository } from "typeorm";
import { Project } from "../../src/entities/Project";
import { Flag } from "../../src/entities/Flag";
import { Environment } from "../../src/entities/Environment";
import { FlagEnvironmentConfig } from "../../src/entities/FlagEnvironmentConfig";
import { FlagConfigService } from "../../src/services/FlagConfigService";

describe("FlagConfigService", () => {
    let dataSource: DataSource;
    let configRepo: Repository<FlagEnvironmentConfig>;
    let flagConfigService: FlagConfigService;
    let project: Project;
    let environment: Environment;
    let flag: Flag;

    beforeAll(async () => {
        dataSource = new DataSource({
            type: "sqlite",
            database: ":memory:",
            dropSchema: true,
            entities: [Project, Flag, Environment, FlagEnvironmentConfig],
            synchronize: true,
            logging: false,
        });
        await dataSource.initialize();
    });

    afterAll(async () => {
        if (dataSource.isInitialized) {
            await dataSource.destroy();
        }
    });

    beforeEach(async () => {
        await dataSource.getRepository(FlagEnvironmentConfig).clear();
        await dataSource.getRepository(Flag).clear();
        await dataSource.getRepository(Environment).clear();
        await dataSource.getRepository(Project).clear();

        configRepo = dataSource.getRepository(FlagEnvironmentConfig);
        flagConfigService = new FlagConfigService(configRepo);

        // Seed references
        project = dataSource.getRepository(Project).create({ name: "Config Test Project" });
        await dataSource.getRepository(Project).save(project);

        environment = dataSource.getRepository(Environment).create({ project, name: "dev", apiKey: "vex_123" });
        await dataSource.getRepository(Environment).save(environment);

        flag = dataSource.getRepository(Flag).create({ project, key: "test-flag", type: "boolean" });
        await dataSource.getRepository(Flag).save(flag);
    });

    it("should create a new flag configuration if none exists", async () => {
        const config = await flagConfigService.setFlagConfig(flag, environment, true);
        expect(config.id).toBeDefined();
        expect(config.isEnabled).toBe(true);
        expect(config.flag.id).toBe(flag.id);
        expect(config.environment.id).toBe(environment.id);
    });

    it("should update an existing flag configuration", async () => {
        await flagConfigService.setFlagConfig(flag, environment, false);
        const updatedConfig = await flagConfigService.setFlagConfig(flag, environment, true, { some: "rule" });
        
        expect(updatedConfig.isEnabled).toBe(true);
        expect(updatedConfig.rules).toHaveProperty("some", "rule");
        
        const count = await configRepo.count();
        expect(count).toBe(1); // Ensures it upserted rather than duplicated
    });

    it("should correctly fetch a flag configuration", async () => {
        await flagConfigService.setFlagConfig(flag, environment, true);
        const fetched = await flagConfigService.getFlagConfig(flag.id, environment.id);
        expect(fetched?.isEnabled).toBe(true);
    });
});
