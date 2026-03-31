import { buildApp } from "../../src/app";
import { DataSource } from "typeorm";
import { Project } from "../../src/entities/Project";
import { Flag } from "../../src/entities/Flag";
import { Environment } from "../../src/entities/Environment";
import supertest from "supertest";

describe("FlagController (Integration)", () => {
    let app: any;
    let dataSource: DataSource;
    let mockProjectId: string;

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
        app = buildApp(dataSource);
        await app.ready();
    });

    afterAll(async () => {
        await app.close();
        if (dataSource.isInitialized) {
            await dataSource.destroy();
        }
    });

    beforeEach(async () => {
        const repo = dataSource.getRepository(Project);
        await repo.clear();
        
        // Seed a project for flag tests
        const res = await supertest(app.server).post("/api/projects").send({ name: "Flag Container" });
        mockProjectId = res.body.id;
    });

    it("should return 404 when creating flag for unknown project", async () => {
        const res = await supertest(app.server)
            .post(`/api/projects/fc00155b-fcf6-4d04-bfc7-c4cbaddba26c/flags`)
            .send({ key: "feature-1" });
        expect(res.status).toBe(404);
    });

    it("should return 201 when creating a valid flag", async () => {
        const res = await supertest(app.server)
            .post(`/api/projects/${mockProjectId}/flags`)
            .send({ key: "new-dashboard", type: "boolean" });
            
        expect(res.status).toBe(201);
        expect(res.body.key).toBe("new-dashboard");
        expect(res.body.type).toBe("boolean");
    });
    
    it("should return 400 when creating a flag with invalid type", async () => {
        const res = await supertest(app.server)
            .post(`/api/projects/${mockProjectId}/flags`)
            .send({ key: "new-dashboard", type: "invalid" });
            
        expect(res.status).toBe(400);
        expect(res.body.error).toContain("Invalid flag type.");
    });

    it("should list flags array", async () => {
        await supertest(app.server).post(`/api/projects/${mockProjectId}/flags`).send({ key: "flag-a" });
        await supertest(app.server).post(`/api/projects/${mockProjectId}/flags`).send({ key: "flag-b" });

        const res = await supertest(app.server).get(`/api/projects/${mockProjectId}/flags`);
        expect(res.status).toBe(200);
        expect(res.body.length).toBe(2);
        
        const keys = res.body.map((f: any) => f.key);
        expect(keys).toContain("flag-a");
        expect(keys).toContain("flag-b");
    });
    
    it("should retrieve a single flag", async () => {
        const creation = await supertest(app.server).post(`/api/projects/${mockProjectId}/flags`).send({ key: "flag-single" });
        const flagId = creation.body.id;

        const res = await supertest(app.server).get(`/api/projects/${mockProjectId}/flags/${flagId}`);
        expect(res.status).toBe(200);
        expect(res.body.key).toBe("flag-single");
    });
});
