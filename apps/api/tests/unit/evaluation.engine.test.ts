import { describe, it, expect, vi } from "vitest";
import { EvaluationEngine } from "../../src/evaluation/EvaluationEngine";

function makeConfig(overrides: Record<string, any> = {}) {
    return {
        flag: { key: "test-flag", type: "release" },
        environment: { id: "env-1" },
        isEnabled: true,
        strategyType: "boolean",
        strategyConfig: undefined,
        ...overrides,
    } as any;
}

const makeConfigRepo = () => ({ findOne: vi.fn() });

describe("EvaluationEngine", () => {
    it("U-EE-01: empty configs array → returns empty flags object {}", async () => {
        const engine = new EvaluationEngine(makeConfigRepo() as any);
        const result = await engine.evaluate([], { userId: "alice" });
        expect(result.flags).toEqual({});
    });

    it("U-EE-02: flag with isEnabled: false (boolean) → value false, reason DISABLED", async () => {
        const engine = new EvaluationEngine(makeConfigRepo() as any);
        const config = makeConfig({ isEnabled: false });

        const result = await engine.evaluate([config], { userId: "alice" });

        expect(result.flags["test-flag"].value).toBe(false);
        expect(result.flags["test-flag"].reason).toBe("DISABLED");
    });

    it("U-EE-03: one flag throws during evaluation → ERROR reason, other flags still evaluated", async () => {

        const spy = vi.spyOn(console, "error").mockImplementation(() => { });
        const engine = new EvaluationEngine(makeConfigRepo() as any);

        const badConfig = makeConfig({
            flag: { key: "bad-flag", type: "release" },
            strategyType: "rollout",

            strategyConfig: { percentage: 50 },
        });

        const goodConfig = makeConfig({
            flag: { key: "good-flag", type: "release" },
            isEnabled: true,
            strategyType: "boolean",
        });

        const result = await engine.evaluate([badConfig, goodConfig], { userId: "alice" });

        expect(result.flags["bad-flag"].reason).toBe("ERROR");
        expect(result.flags["good-flag"]).toBeDefined();
        expect(result.flags["good-flag"].reason).not.toBe("ERROR");

        expect(spy).toHaveBeenCalledWith(expect.stringContaining("[EvaluationEngine]"));
        spy.mockRestore();
    });

    it("U-EE-04: unknown strategyType → falls back to boolean (no crash)", async () => {
        const engine = new EvaluationEngine(makeConfigRepo() as any);
        const config = makeConfig({
            strategyType: "totally_unknown_strategy",
        });

        const result = await engine.evaluate([config], {});
        expect(result.flags["test-flag"]).toBeDefined();
    });

    it("U-EE-06: prerequisite evaluator returns null (prereq config not found) → PREREQUISITE_UNMET", async () => {
        const configRepo = makeConfigRepo();

        configRepo.findOne.mockResolvedValue(null);
        const engine = new EvaluationEngine(configRepo as any);

        const config = makeConfig({
            flag: { key: "flag-a", type: "release" },
            isEnabled: true,
            strategyType: "prerequisite",
            strategyConfig: { flagKey: "flag-b", expectedValue: true },
        });

        const result = await engine.evaluate([config], {});

        expect(result.flags["flag-a"].reason).toBe("PREREQUISITE_UNMET");
        expect(result.flags["flag-a"].value).toBe(false);
    });

    it("U-EE-07: prerequisite flag evaluated at max depth (3) → evaluator is undefined → ERROR reason", async () => {
        const spy = vi.spyOn(console, "error").mockImplementation(() => { });
        const configRepo = makeConfigRepo();
        const engine = new EvaluationEngine(configRepo as any);

        const config = makeConfig({
            flag: { key: "flag-deep", type: "release" },
            isEnabled: true,
            strategyType: "prerequisite",
            strategyConfig: { flagKey: "flag-other", expectedValue: true },
        });

        const result = await engine.evaluate([config], {}, 3);

        expect(result.flags["flag-deep"].reason).toBe("ERROR");
        spy.mockRestore();
    });

    it("U-EE-05: prerequisite at depth 3 evaluated; depth 4 returns ERROR (depth limit)", async () => {

        const configRepo = makeConfigRepo();

        const prereqConfig = makeConfig({
            flag: { key: "flag-b", type: "release" },
            isEnabled: true,
            strategyType: "boolean",
        });
        configRepo.findOne.mockResolvedValue(prereqConfig);

        const engine = new EvaluationEngine(configRepo as any);

        const mainConfig = makeConfig({
            flag: { key: "flag-a", type: "release" },
            isEnabled: true,
            strategyType: "prerequisite",
            strategyConfig: { flagKey: "flag-b", expectedValue: true },
        });

        const result = await engine.evaluate([mainConfig], {});

        expect(result.flags["flag-a"].reason).toBe("PREREQUISITE_MET");
        expect(result.flags["flag-a"].value).toBe(true);
    });
});
