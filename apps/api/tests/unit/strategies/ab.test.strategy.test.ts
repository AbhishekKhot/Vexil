// Unit tests: AbTestStrategy (U-ST-14..18)
import { describe, it, expect } from "vitest";
import { AbTestStrategy } from "../../../src/evaluation/strategies/AbTestStrategy";
import { StrategyValidationError } from "../../../src/evaluation/EvaluationStrategy.interface";

const twoVariants = [
    { key: "control", value: false, weight: 50 },
    { key: "treatment", value: true, weight: 50 },
];

describe("AbTestStrategy", () => {
    it("U-ST-14: valid variants → same userId always lands in same variant (deterministic)", () => {
        const s = new AbTestStrategy({ strategyType: "ab_test", variants: twoVariants, hashAttribute: "userId" }, "ab-flag");
        const r1 = s.evaluate({ userId: "alice" });
        const r2 = s.evaluate({ userId: "alice" });
        expect(r1.variant).toBe(r2.variant);
        expect(r1.value).toBe(r2.value);
    });

    it("U-ST-15: weights sum to 100 with 2 variants → both variants reachable across user set", () => {
        const s = new AbTestStrategy({ strategyType: "ab_test", variants: twoVariants, hashAttribute: "userId" }, "ab-flag");
        const variants = new Set<string>();
        const users = ["alice", "bob", "charlie", "dave", "eve", "frank", "grace", "henry", "ivan", "julia",
            "kurt", "laura", "mike", "nina", "oscar", "pam", "quinn", "ray", "sara", "tom"];
        for (const id of users) {
            const r = s.evaluate({ userId: id });
            variants.add(r.variant as string);
        }
        // With 20 diverse users, both variants should appear
        expect(variants.size).toBeGreaterThanOrEqual(2);
    });

    it("U-ST-16: missing identifier in context → falls back to first variant", () => {
        const s = new AbTestStrategy({ strategyType: "ab_test", variants: twoVariants, hashAttribute: "userId" }, "ab-flag");
        const r = s.evaluate({ plan: "pro" }); // no userId
        expect(r.variant).toBe("control");
        expect(r.reason).toBe("MISSING_CONTEXT");
    });

    it("U-ST-17: variants not an array → StrategyValidationError", () => {
        expect(() =>
            new AbTestStrategy(
                { strategyType: "ab_test", variants: null as any, hashAttribute: "userId" },
                "ab-flag"
            )
        ).toThrow(StrategyValidationError);
    });

    it("U-ST-18: variant weights don't sum to 100 → StrategyValidationError", () => {
        expect(() =>
            new AbTestStrategy(
                {
                    strategyType: "ab_test",
                    variants: [
                        { key: "a", value: true, weight: 60 },
                        { key: "b", value: false, weight: 60 }, // 120 total
                    ],
                    hashAttribute: "userId",
                },
                "ab-flag"
            )
        ).toThrow(StrategyValidationError);
    });

    it("U-ST-19: all users get a valid variant (covers full variant list, including last)", () => {
        // Use a 3-variant config where the last variant has a non-trivial weight
        // This exercises the fallback path for users hashing near bucket 100
        const threeVariants = [
            { key: "a", value: "A", weight: 33 },
            { key: "b", value: "B", weight: 33 },
            { key: "c", value: "C", weight: 34 },
        ];
        const s = new AbTestStrategy(
            { strategyType: "ab_test", variants: threeVariants, hashAttribute: "userId" },
            "three-way-flag"
        );
        const users = ["alice", "bob", "charlie", "dave", "eve", "frank", "grace", "henry", "ivan",
            "julia", "kurt", "laura", "mike", "nina", "oscar", "pam", "quinn", "ray"];
        const seen = new Set<string>();
        for (const id of users) {
            const r = s.evaluate({ userId: id });
            expect(r.reason).toBe("AB_VARIANT");
            expect(["a", "b", "c"]).toContain(r.variant);
            seen.add(r.variant as string);
        }
        // All 3 variants should be reachable
        expect(seen.size).toBe(3);
    });

    it("U-ST-20: empty identifier string → falls back to first variant (MISSING_CONTEXT)", () => {
        const s = new AbTestStrategy({ strategyType: "ab_test", variants: twoVariants, hashAttribute: "userId" }, "ab-flag");
        const r = s.evaluate({ userId: "  " }); // whitespace-only
        expect(r.variant).toBe("control");
        expect(r.reason).toBe("MISSING_CONTEXT");
    });
});
