import { buildApp } from "../../src/app";
import { DataSource } from "typeorm";
import { Project } from "../../src/entities/Project";
import { Flag } from "../../src/entities/Flag";
import { Environment } from "../../src/entities/Environment";
import { FlagEnvironmentConfig } from "../../src/entities/FlagEnvironmentConfig";
import supertest from "supertest";

describe("FlagConfigController (Integration)", () => {
    let app: any;
    let dataSource: DataSource;
    let mockProject: any;
    let mockEnv: any;
    let mockFlag: any;

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
        await dataSource.getRepository(FlagEnvironmentConfig).clear();
        await dataSource.getRepository(Flag).clear();
        await dataSource.getRepository(Environment).clear();
        await dataSource.getRepository(Project).clear();
        
        // Seed basis
        const projRes = await supertest(app.server).post("/api/projects").send({ name: "Config Container" });
        mockProject = projRes.body;

        const envRes = await supertest(app.server).post(`/api/projects/${mockProject.id}/environments`).send({ name: "staging" });
        mockEnv = envRes.body;

        const flagRes = await supertest(app.server).post(`/api/projects/${mockProject.id}/flags`).send({ key: "feature-2", type: "boolean" });
        mockFlag = flagRes.body;
    });

    it("should set and update a flag configuration directly", async () => {
        // Initial set
        let res = await supertest(app.server)
            .put(`/api/projects/${mockProject.id}/environments/${mockEnv.id}/flags/${mockFlag.id}`)
            .send({ isEnabled: true });
        
        expect(res.status).toBe(200);
        expect(res.body.isEnabled).toBe(true);

        // Update set
        res = await supertest(app.server)
            .put(`/api/projects/${mockProject.id}/environments/${mockEnv.id}/flags/${mockFlag.id}`)
            .send({ isEnabled: false, rules: { targetGroup: "internal" } });

        expect(res.status).toBe(200);
        expect(res.body.isEnabled).toBe(false);
        expect(res.body.rules).toHaveProperty("targetGroup", "internal");
    });
    
    it("should fetch a specific configuration", async () => {
        await supertest(app.server)
            .put(`/api/projects/${mockProject.id}/environments/${mockEnv.id}/flags/${mockFlag.id}`)
            .send({ isEnabled: true });

        const res = await supertest(app.server).get(`/api/projects/${mockProject.id}/environments/${mockEnv.id}/flags/${mockFlag.id}`);
        expect(res.status).toBe(200);
        expect(res.body.isEnabled).toBe(true);
    });

    it("should return 404 for missing flag config", async () => {
        const res = await supertest(app.server).get(`/api/projects/${mockProject.id}/environments/${mockEnv.id}/flags/unknown-uuid`);
        expect(res.status).toBe(404);
    });
});
