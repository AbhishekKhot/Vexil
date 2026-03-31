import { DataSource, Repository } from "typeorm";
import { Project } from "../../src/entities/Project";
import { Flag } from "../../src/entities/Flag";
import { Environment } from "../../src/entities/Environment";
import { EnvironmentService } from "../../src/services/EnvironmentService";
import { ProjectService } from "../../src/services/ProjectService";

describe("EnvironmentService", () => {
    let dataSource: DataSource;
    let envRepository: Repository<Environment>;
    let projectRepository: Repository<Project>;
    let environmentService: EnvironmentService;
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
        envRepository = dataSource.getRepository(Environment);
        projectRepository = dataSource.getRepository(Project);
        environmentService = new EnvironmentService(envRepository);
        projectService = new ProjectService(projectRepository);

        mockProject = await projectService.createProject("Env Test Project");
    });

    it("should create an environment and generate an SDK apiKey", async () => {
        const env = await environmentService.createEnvironment(mockProject, "staging");
        expect(env.id).toBeDefined();
        expect(env.name).toBe("staging");
        // vex_ prefix + 24 bytes (48 hex chars)
        expect(env.apiKey).toMatch(/^vex_[a-f0-9]{48}$/);
        expect(env.project.id).toBe(mockProject.id);
    });

    it("should throw an error if environment name is too short", async () => {
        await expect(environmentService.createEnvironment(mockProject, "a")).rejects.toThrow("Environment name must be at least 2 characters");
    });

    it("should list environments for a given project", async () => {
        await environmentService.createEnvironment(mockProject, "dev");
        await environmentService.createEnvironment(mockProject, "prod");

        const envs = await environmentService.listEnvironments(mockProject.id);
        expect(envs.length).toBe(2);
        
        const names = envs.map(e => e.name);
        expect(names).toContain("dev");
        expect(names).toContain("prod");
    });
});
