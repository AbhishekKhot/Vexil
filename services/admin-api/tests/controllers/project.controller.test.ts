import { buildApp } from "../../src/app";
import { DataSource } from "typeorm";
import { Project } from "../../src/entities/Project";
import { Flag } from "../../src/entities/Flag";
import { Environment } from "../../src/entities/Environment";
import supertest from "supertest";

describe("ProjectController (Integration)", () => {
    let app: any;
    let dataSource: DataSource;

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
    });

    it("should return 400 for empty project name", async () => {
        const response = await supertest(app.server)
            .post("/api/projects")
            .send({ name: "" });

        expect(response.status).toBe(400);
        expect(response.body.error).toBe("Project name must be at least 3 characters");
    });

    it("should return 201 for valid project creation", async () => {
        const response = await supertest(app.server)
            .post("/api/projects")
            .send({ name: "Vexil Init" });

        expect(response.status).toBe(201);
        expect(response.body.id).toBeDefined();
        expect(response.body.name).toBe("Vexil Init");
    });

    it("should list projects (no dummies)", async () => {
        await supertest(app.server).post("/api/projects").send({ name: "Test Proj 1" });
        await supertest(app.server).post("/api/projects").send({ name: "Test Proj 2" });

        const response = await supertest(app.server).get("/api/projects");
        expect(response.status).toBe(200);
        expect(Array.isArray(response.body)).toBe(true);
        expect(response.body.length).toBe(2);
        const names = response.body.map((p: any) => p.name);
        expect(names).toContain("Test Proj 1");
    });

    it("should retrieve specific project", async () => {
        const createRes = await supertest(app.server).post("/api/projects").send({ name: "Single Proj" });
        const id = createRes.body.id;

        const getRes = await supertest(app.server).get(`/api/projects/${id}`);
        expect(getRes.status).toBe(200);
        expect(getRes.body.name).toBe("Single Proj");
    });

    it("should return 404 for invalid project id", async () => {
        const getRes = await supertest(app.server).get(`/api/projects/fc00155b-fcf6-4d04-bfc7-c4cbaddba26c`);
        expect(getRes.status).toBe(404);
        expect(getRes.body.error).toBe("Project not found");
    });
});
