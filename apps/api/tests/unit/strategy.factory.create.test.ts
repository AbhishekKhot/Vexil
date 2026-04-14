import "reflect-metadata";
// Unit tests: StrategyFactory.create() — all strategy types instantiated
import { describe, it, expect, vi } from "vitest";
import { StrategyFactory } from "../../src/evaluation/StrategyFactory";
import { StrategyValidationError } from "../../src/evaluation/EvaluationStrategy.interface";

describe("StrategyFactory.create()", () => {

    it("SF-C-01: creates BooleanStrategy for type 'boolean'", () => {
        const s = StrategyFactory.create({
            strategyConfig: { strategyType: "boolean" },
            isEnabled: true,
            flagKey: "f",
        });
        expect(s.strategyType).toBe("boolean");
        expect(s.evaluate({})).toMatchObject({ value: true });
    });

    it("SF-C-02: BooleanStrategy with isEnabled: false → DISABLED", () => {
        const s = StrategyFactory.create({
            strategyConfig: { strategyType: "boolean" },
            isEnabled: false,
            flagKey: "f",
        });
        expect(s.evaluate({})).toMatchObject({ value: false, reason: "DISABLED" });
    });

    it("SF-C-03: creates RolloutStrategy for type 'rollout'", () => {
        const s = StrategyFactory.create({
            strategyConfig: { strategyType: "rollout", percentage: 100, hashAttribute: "userId" },
            isEnabled: true,
            flagKey: "f",
        });
        expect(s.strategyType).toBe("rollout");
        expect(s.evaluate({ userId: "alice" })).toMatchObject({ reason: "ROLLOUT_IN" });
    });

    it("SF-C-04: creates TargetedRolloutStrategy for type 'targeted_rollout'", () => {
        const s = StrategyFactory.create({
            strategyConfig: {
                strategyType: "targeted_rollout",
                percentage: 100,
                hashAttribute: "userId",
                rules: [{ attribute: "plan", operator: "eq" as const, values: ["pro"] }],
            },
            isEnabled: true,
            flagKey: "f",
        });
        expect(s.strategyType).toBe("targeted_rollout");
        // Matching rule + 100% → TARGETED_IN
        expect(s.evaluate({ userId: "u1", plan: "pro" })).toMatchObject({ reason: "TARGETED_IN" });
    });

    it("SF-C-05: creates UserTargetingStrategy for type 'user_targeting'", () => {
        const s = StrategyFactory.create({
            strategyConfig: {
                strategyType: "user_targeting",
                userIds: ["alice"],
                hashAttribute: "userId",
                fallthrough: false,
            },
            isEnabled: true,
            flagKey: "f",
        });
        expect(s.strategyType).toBe("user_targeting");
        expect(s.evaluate({ userId: "alice" })).toMatchObject({ reason: "USER_WHITELIST" });
    });

    it("SF-C-06: creates AttributeMatchingStrategy for type 'attribute_matching'", () => {
        const s = StrategyFactory.create({
            strategyConfig: {
                strategyType: "attribute_matching",
                rules: [{ attribute: "country", operator: "eq" as const, values: ["US"] }],
            },
            isEnabled: true,
            flagKey: "f",
        });
        expect(s.strategyType).toBe("attribute_matching");
        expect(s.evaluate({ country: "US" })).toMatchObject({ reason: "ATTRIBUTE_MATCH" });
    });

    it("SF-C-07: creates AbTestStrategy for type 'ab_test'", async () => {
        const s = StrategyFactory.create({
            strategyConfig: {
                strategyType: "ab_test",
                variants: [
                    { key: "control", value: false, weight: 50 },
                    { key: "treatment", value: true, weight: 50 },
                ],
                hashAttribute: "userId",
            },
            isEnabled: true,
            flagKey: "f",
        });
        expect(s.strategyType).toBe("ab_test");
        const r = await s.evaluate({ userId: "alice" });
        expect(r.reason).toBe("AB_VARIANT");
        expect(r.variant).toBeDefined();
    });

    it("SF-C-08: creates TimeWindowStrategy for type 'time_window'", () => {
        const future = new Date(Date.now() + 60_000).toISOString();
        const farFuture = new Date(Date.now() + 120_000).toISOString();
        const s = StrategyFactory.create({
            strategyConfig: { strategyType: "time_window", startDate: future, endDate: farFuture },
            isEnabled: true,
            flagKey: "f",
        });
        expect(s.strategyType).toBe("time_window");
    });

    it("SF-C-09: creates PrerequisiteStrategy with evaluator for type 'prerequisite'", async () => {
        const evaluator = vi.fn().mockResolvedValue({ value: true, reason: "ENABLED" as const });
        const s = StrategyFactory.create({
            strategyConfig: { strategyType: "prerequisite", flagKey: "dep-flag", expectedValue: true },
            isEnabled: true,
            flagKey: "f",
            prerequisiteEvaluator: evaluator,
        });
        expect(s.strategyType).toBe("prerequisite");
        const r = await s.evaluate({});
        expect(r.reason).toBe("PREREQUISITE_MET");
    });

    it("SF-C-10: prerequisite type without evaluator → throws StrategyValidationError", () => {
        expect(() => StrategyFactory.create({
            strategyConfig: { strategyType: "prerequisite", flagKey: "dep-flag", expectedValue: true },
            isEnabled: true,
            flagKey: "f",
            // no prerequisiteEvaluator
        })).toThrow(StrategyValidationError);
    });

    it("SF-C-11: unknown strategyType → throws StrategyValidationError", () => {
        expect(() => StrategyFactory.create({
            strategyConfig: { strategyType: "unknown_type" } as any,
            isEnabled: true,
            flagKey: "f",
        })).toThrow(StrategyValidationError);
    });
});

describe("StrategyFactory.parse() — additional branches", () => {

    it("SF-P-01: missing strategyType field → throws", () => {
        expect(() => StrategyFactory.parse({ percentage: 50 })).toThrow("strategyType");
    });

    it("SF-P-02: null input → throws", () => {
        expect(() => StrategyFactory.parse(null)).toThrow();
    });

    it("SF-P-03: invalid strategyType string → throws with type name", () => {
        expect(() => StrategyFactory.parse({ strategyType: "magic" })).toThrow("magic");
    });

    it("SF-P-04: rollout missing percentage → throws", () => {
        expect(() => StrategyFactory.parse({ strategyType: "rollout", hashAttribute: "userId" })).toThrow("percentage required");
    });

    it("SF-P-05: targeted_rollout with percentage as string → throws", () => {
        expect(() => StrategyFactory.parse({ strategyType: "targeted_rollout", percentage: "50", hashAttribute: "userId" })).toThrow("percentage required");
    });

    it("SF-P-06: user_targeting missing userIds → throws", () => {
        expect(() => StrategyFactory.parse({ strategyType: "user_targeting", hashAttribute: "userId" })).toThrow("userIds");
    });

    it("SF-P-07: attribute_matching with empty rules array → throws", () => {
        expect(() => StrategyFactory.parse({ strategyType: "attribute_matching", rules: [] })).toThrow("non-empty array");
    });

    it("SF-P-08: ab_test missing variants → throws", () => {
        expect(() => StrategyFactory.parse({ strategyType: "ab_test", hashAttribute: "userId" })).toThrow("variants");
    });

    it("SF-P-09: time_window missing endDate → throws", () => {
        expect(() => StrategyFactory.parse({ strategyType: "time_window", startDate: "2025-01-01" })).toThrow("endDate");
    });

    it("SF-P-10: prerequisite missing flagKey → throws", () => {
        expect(() => StrategyFactory.parse({ strategyType: "prerequisite", expectedValue: true })).toThrow("flagKey");
    });

    it("SF-P-11: boolean strategyType → returns config as-is", () => {
        const result = StrategyFactory.parse({ strategyType: "boolean" });
        expect(result).toMatchObject({ strategyType: "boolean" });
    });

    // Valid inputs for each type — cover the break paths at lines 61–70

    it("SF-P-12: valid user_targeting (userIds array present) → returns config without throwing", () => {
        const result = StrategyFactory.parse({ strategyType: "user_targeting", userIds: ["u1", "u2"], hashAttribute: "userId", fallthrough: false });
        expect(result).toMatchObject({ strategyType: "user_targeting" });
    });

    it("SF-P-13: valid attribute_matching (non-empty rules array) → returns config without throwing", () => {
        const result = StrategyFactory.parse({ strategyType: "attribute_matching", rules: [{ attribute: "country", operator: "eq", values: ["US"] }] });
        expect(result).toMatchObject({ strategyType: "attribute_matching" });
    });

    it("SF-P-14: valid ab_test (variants array present) → returns config without throwing", () => {
        const result = StrategyFactory.parse({ strategyType: "ab_test", variants: [{ key: "a", value: true, weight: 50 }, { key: "b", value: false, weight: 50 }], hashAttribute: "userId" });
        expect(result).toMatchObject({ strategyType: "ab_test" });
    });

    it("SF-P-15: valid time_window (startDate and endDate present) → returns config without throwing", () => {
        const result = StrategyFactory.parse({ strategyType: "time_window", startDate: "2025-01-01T00:00:00Z", endDate: "2025-12-31T23:59:59Z" });
        expect(result).toMatchObject({ strategyType: "time_window" });
    });

    it("SF-P-16: valid prerequisite (flagKey string present) → returns config without throwing", () => {
        const result = StrategyFactory.parse({ strategyType: "prerequisite", flagKey: "other-flag", expectedValue: true });
        expect(result).toMatchObject({ strategyType: "prerequisite" });
    });
});
