import { DataSource, Repository } from "typeorm";
import { Project } from "../../src/entities/Project";
import { Flag } from "../../src/entities/Flag";
import { Environment } from "../../src/entities/Environment";
import { ProjectService } from "../../src/services/ProjectService";

describe("ProjectService", () => {
    let dataSource: DataSource;
    let projectRepository: Repository<Project>;
    let projectService: ProjectService;

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
        projectRepository = dataSource.getRepository(Project);
        projectService = new ProjectService(projectRepository);
    });

    it("should throw an error if project name is too short", async () => {
        await expect(projectService.createProject("Ab")).rejects.toThrow("Project name must be at least 3 characters");
    });

    it("should successfully create a project in the database", async () => {
        const project = await projectService.createProject("Vexil Core");
        expect(project.id).toBeDefined();
        expect(project.name).toBe("Vexil Core");
        const count = await projectRepository.count();
        expect(count).toBe(1);
    });

    it("should list all projects without dummy values", async () => {
        await projectService.createProject("Proj 1");
        await projectService.createProject("Proj 2");

        const projects = await projectService.listProjects();
        expect(projects.length).toBe(2);
        expect(projects.map(p => p.name)).toContain("Proj 1");
        expect(projects.map(p => p.name)).toContain("Proj 2");
    });

    it("should get a project by ID", async () => {
        const created = await projectService.createProject("Proj X");
        const fetched = await projectService.getProject(created.id);
        expect(fetched).not.toBeNull();
        expect(fetched?.name).toBe("Proj X");
    });
});
