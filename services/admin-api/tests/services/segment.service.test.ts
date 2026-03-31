import { DataSource, Repository } from "typeorm";
import { Project } from "../../src/entities/Project";
import { Segment } from "../../src/entities/Segment";
import { SegmentService } from "../../src/services/SegmentService";

describe("SegmentService", () => {
    let dataSource: DataSource;
    let segmentRepo: Repository<Segment>;
    let segmentService: SegmentService;
    let project: Project;

    beforeAll(async () => {
        dataSource = new DataSource({
            type: "sqlite",
            database: ":memory:",
            dropSchema: true,
            entities: [Project, Segment],
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
        await dataSource.getRepository(Segment).clear();
        await dataSource.getRepository(Project).clear();

        segmentRepo = dataSource.getRepository(Segment);
        segmentService = new SegmentService(segmentRepo);

        project = dataSource.getRepository(Project).create({ name: "Segment Test Project" });
        await dataSource.getRepository(Project).save(project);
    });

    it("should create a segment with valid rules", async () => {
        const rules = [{ attribute: "email", operator: "endsWith", value: "@acme.com" }];
        const segment = await segmentService.createSegment(project, "Acme Employees", rules, "Targets internal team");
        
        expect(segment.id).toBeDefined();
        expect(segment.name).toBe("Acme Employees");
        expect(segment.rules[0].operator).toBe("endsWith");
        expect(segment.project.id).toBe(project.id);
    });

    it("should reject segment creation without rules", async () => {
        await expect(segmentService.createSegment(project, "Empty Segment", null)).rejects.toThrow("Segment must have valid targeting rules");
    });

    it("should list segments correctly", async () => {
        await segmentService.createSegment(project, "Seg1", {});
        await segmentService.createSegment(project, "Seg2", {});
        
        const segments = await segmentService.listSegments(project.id);
        expect(segments.length).toBe(2);
    });
});
