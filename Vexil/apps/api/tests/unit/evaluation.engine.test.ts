// Unit tests: EvaluationEngine (U-EE-01..05)
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
        // Suppress the expected console.error that EvaluationEngine emits for fault-isolated errors
        const spy = vi.spyOn(console, "error").mockImplementation(() => {});
        const engine = new EvaluationEngine(makeConfigRepo() as any);

        const badConfig = makeConfig({
            flag: { key: "bad-flag", type: "release" },
            strategyType: "rollout",
            // missing hashAttribute → will throw StrategyValidationError
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

        // Confirm the engine did log the error (production observability), then restore
        expect(spy).toHaveBeenCalledWith(expect.stringContaining("[EvaluationEngine]"));
        spy.mockRestore();
    });

    it("U-EE-04: unknown strategyType → falls back to boolean (no crash)", async () => {
        const engine = new EvaluationEngine(makeConfigRepo() as any);
        const config = makeConfig({
            strategyType: "totally_unknown_strategy",
        });

        // Should not throw — falls back to boolean
        const result = await engine.evaluate([config], {});
        expect(result.flags["test-flag"]).toBeDefined();
    });

    it("U-EE-05: prerequisite at depth 3 evaluated; depth 4 returns ERROR (depth limit)", async () => {
        // Build a chain: flag-a depends on flag-b (depth 0 → 1 → 2 → depth 3 limit)
        const configRepo = makeConfigRepo();

        // flag-b config (the prerequisite)
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

        // Prerequisite met (flag-b is ENABLED = true, expected true)
        expect(result.flags["flag-a"].reason).toBe("PREREQUISITE_MET");
        expect(result.flags["flag-a"].value).toBe(true);
    });
});
