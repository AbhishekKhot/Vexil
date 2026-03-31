import { buildApp } from "../../src/app";
import { DataSource } from "typeorm";
import { Project } from "../../src/entities/Project";
import { Environment } from "../../src/entities/Environment";
import supertest from "supertest";

process.env.NODE_ENV = 'test';

describe("AnalyticsController Integration", () => {
    let app: any;
    let dataSource: DataSource;
    let mockProjectId: string;
    let mockEnvId: string;
    let mockApiKey: string;

    beforeAll(async () => {
        dataSource = new DataSource({
            type: "sqlite",
            database: ":memory:",
            dropSchema: true,
            entities: [Project, Environment],
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
        await dataSource.getRepository(Environment).clear();
        await dataSource.getRepository(Project).clear();
        
        const projRes = await supertest(app.server).post("/api/projects").send({ name: "Analytics Container" });
        mockProjectId = projRes.body.id;

        const envRes = await supertest(app.server).post(`/api/projects/${mockProjectId}/environments`).send({ name: "production" });
        mockEnvId = envRes.body.id;
        mockApiKey = envRes.body.apiKey;
    });

    it("should return 401 without an API key", async () => {
        const res = await supertest(app.server).post("/v1/events").send([{ type: "eval", key: "feature-1" }]);
        expect(res.status).toBe(401);
    });

    it("should accept valid payload with 202 Accepted", async () => {
        const events = [
            { kind: "eval", flagKey: "feature-1", value: true, uid: "user-123", timestamp: Date.now() }
        ];

        const res = await supertest(app.server)
            .post("/v1/events")
            .set("Authorization", `Bearer ${mockApiKey}`)
            .send(events);
            
        expect(res.status).toBe(202);
        expect(res.body.status).toBe("accepted");
    });
});
