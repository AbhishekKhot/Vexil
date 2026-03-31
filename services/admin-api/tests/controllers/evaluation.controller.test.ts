import { buildApp } from "../../src/app";
import { DataSource } from "typeorm";
import { Project } from "../../src/entities/Project";
import { Flag } from "../../src/entities/Flag";
import { Environment } from "../../src/entities/Environment";
import { FlagEnvironmentConfig } from "../../src/entities/FlagEnvironmentConfig";
import supertest from "supertest";

// Mock Redis directly globally if needed, or it's handled gracefully in the route setup block via process.env.NODE_ENV
process.env.NODE_ENV = 'test';

describe("EvaluationController Integration", () => {
    let app: any;
    let dataSource: DataSource;
    let mockProjectId: string;
    let mockEnvId: string;
    let mockApiKey: string;
    let mockFlagId: string;

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
        
        // Seed environment
        const projRes = await supertest(app.server).post("/api/projects").send({ name: "Data Plane App" });
        mockProjectId = projRes.body.id;

        const envRes = await supertest(app.server).post(`/api/projects/${mockProjectId}/environments`).send({ name: "production" });
        mockEnvId = envRes.body.id;
        mockApiKey = envRes.body.apiKey;

        const flagRes = await supertest(app.server).post(`/api/projects/${mockProjectId}/flags`).send({ key: "feature-dark-mode", type: "boolean" });
        mockFlagId = flagRes.body.id;

        await supertest(app.server)
            .put(`/api/projects/${mockProjectId}/environments/${mockEnvId}/flags/${mockFlagId}`)
            .send({ isEnabled: true });
    });

    it("should return 401 without an API key", async () => {
        const res = await supertest(app.server).post("/v1/eval");
        expect(res.status).toBe(401);
    });

    it("should return 401 with an INVALID API key", async () => {
        const res = await supertest(app.server)
            .post("/v1/eval")
            .set("Authorization", "Bearer invalid-key");
        expect(res.status).toBe(401);
    });

    it("should return flags mapped on valid API key", async () => {
        const res = await supertest(app.server)
            .post("/v1/eval")
            .set("Authorization", `Bearer ${mockApiKey}`);
            
        expect(res.status).toBe(200);
        expect(res.body.flags).toHaveProperty("feature-dark-mode");
        expect(res.body.flags["feature-dark-mode"].value).toBe(true);
    });
    
    it("should serve flags efficiently via Redis cache on immediate second call", async () => {
        // First call populates cache
        await supertest(app.server).post("/v1/eval").set("Authorization", `Bearer ${mockApiKey}`);
        
        // Let's modify the flag silently in the DB layer (bypassing normal clear cache mechanisms)
        const configRepo = dataSource.getRepository(FlagEnvironmentConfig);
        await configRepo.update({ environment: { id: mockEnvId } }, { isEnabled: false });

        // Second call should return true (cached), proving cache hit
        const cacheRes = await supertest(app.server).post("/v1/eval").set("Authorization", `Bearer ${mockApiKey}`);
        expect(cacheRes.status).toBe(200);
        expect(cacheRes.body.flags["feature-dark-mode"].value).toBe(true);
    });
});
