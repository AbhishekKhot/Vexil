import { DataSource, Repository } from "typeorm";
import { Project } from "../../src/entities/Project";
import { Flag } from "../../src/entities/Flag";
import { Environment } from "../../src/entities/Environment";
import { FlagService } from "../../src/services/FlagService";
import { ProjectService } from "../../src/services/ProjectService";

describe("FlagService", () => {
    let dataSource: DataSource;
    let flagRepository: Repository<Flag>;
    let projectRepository: Repository<Project>;
    let flagService: FlagService;
    let projectService: ProjectService;
    let mockProject: Project;

    beforeAll(async () => {
        dataSource = new DataSource({
            type: "sqlite",
            database: ":memory:",
            dropSchema: true,
            entities: [Project, Flag, Environment],
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
        const entities = dataSource.entityMetadatas;
        for (const entity of entities) {
            const repository = dataSource.getRepository(entity.name);
            await repository.clear();
        }
        flagRepository = dataSource.getRepository(Flag);
        projectRepository = dataSource.getRepository(Project);
        flagService = new FlagService(flagRepository);
        projectService = new ProjectService(projectRepository);

        mockProject = await projectService.createProject("Flag Test Project");
    });

    it("should create a flag with valid input", async () => {
        const flag = await flagService.createFlag(mockProject, "new-ui-feature", "boolean", "Enables the new UI");
        expect(flag.id).toBeDefined();
        expect(flag.key).toBe("new-ui-feature");
        expect(flag.type).toBe("boolean");
        expect(flag.project.id).toBe(mockProject.id);
    });

    it("should reject an invalid flag key format", async () => {
        await expect(flagService.createFlag(mockProject, "Invalid_Key!")).rejects.toThrow("Flag key can only contain lowercase letters, numbers, and hyphens");
    });

    it("should reject an invalid flag type", async () => {
        await expect(flagService.createFlag(mockProject, "test-flag", "invalid-type")).rejects.toThrow("Invalid flag type.");
    });

    it("should list flags for a project", async () => {
        await flagService.createFlag(mockProject, "flag-1");
        await flagService.createFlag(mockProject, "flag-2");

        const flags = await flagService.listFlags(mockProject.id);
        expect(flags.length).toBe(2);
        
        const keys = flags.map(f => f.key);
        expect(keys).toContain("flag-1");
        expect(keys).toContain("flag-2");
    });
});
