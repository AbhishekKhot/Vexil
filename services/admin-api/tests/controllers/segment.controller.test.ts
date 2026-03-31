import { buildApp } from "../../src/app";
import { DataSource } from "typeorm";
import { Project } from "../../src/entities/Project";
import { Flag } from "../../src/entities/Flag";
import { Environment } from "../../src/entities/Environment";
import { FlagEnvironmentConfig } from "../../src/entities/FlagEnvironmentConfig";
import { Segment } from "../../src/entities/Segment";
import supertest from "supertest";

describe("SegmentController (Integration)", () => {
    let app: any;
    let dataSource: DataSource;
    let mockProjectId: string;

    beforeAll(async () => {
        dataSource = new DataSource({
            type: "sqlite",
            database: ":memory:",
            dropSchema: true,
            entities: [Project, Flag, Environment, FlagEnvironmentConfig, Segment],
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
        await dataSource.getRepository(Segment).clear();
        await dataSource.getRepository(Project).clear();
        
        const res = await supertest(app.server).post("/api/projects").send({ name: "Segment Container" });
        mockProjectId = res.body.id;
    });

    it("should return 201 when creating a valid segment", async () => {
        const rules = [{ attribute: "tier", operator: "equals", value: "premium" }];
        const res = await supertest(app.server)
            .post(`/api/projects/${mockProjectId}/segments`)
            .send({ name: "Premium Users", rules });
            
        expect(res.status).toBe(201);
        expect(res.body.name).toBe("Premium Users");
        expect(res.body.rules[0].operator).toBe("equals");
    });
    
    it("should return 400 when missing rules", async () => {
        const res = await supertest(app.server)
            .post(`/api/projects/${mockProjectId}/segments`)
            .send({ name: "Invalid Seg" });
            
        expect(res.status).toBe(400);
        expect(res.body.error).toContain("Segment must have valid targeting rules");
    });

    it("should list segments array", async () => {
        await supertest(app.server).post(`/api/projects/${mockProjectId}/segments`).send({ name: "seg1", rules: {} });
        await supertest(app.server).post(`/api/projects/${mockProjectId}/segments`).send({ name: "seg2", rules: {} });

        const res = await supertest(app.server).get(`/api/projects/${mockProjectId}/segments`);
        expect(res.status).toBe(200);
        expect(res.body.length).toBe(2);
    });

    it("should retrieve a single segment", async () => {
        const createRes = await supertest(app.server).post(`/api/projects/${mockProjectId}/segments`).send({ name: "seg-single", rules: {} });
        const res = await supertest(app.server).get(`/api/projects/${mockProjectId}/segments/${createRes.body.id}`);
        expect(res.status).toBe(200);
        expect(res.body.name).toBe("seg-single");
    });
});
