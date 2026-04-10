// Unit tests: RolloutStrategy (U-ST-04..08)
import { describe, it, expect } from "vitest";
import { RolloutStrategy } from "../../../src/evaluation/strategies/RolloutStrategy";
import { StrategyValidationError } from "../../../src/evaluation/EvaluationStrategy.interface";

describe("RolloutStrategy", () => {
    it("U-ST-04: percentage: 0 → always ROLLOUT_OUT for any userId", () => {
        const s = new RolloutStrategy({ strategyType: "rollout", percentage: 0, hashAttribute: "userId" }, "flag-k");
        const users = ["alice", "bob", "charlie", "dave", "eve", "frank", "grace", "henry"];
        for (const id of users) {
            const r = s.evaluate({ userId: id });
            expect(r.value).toBe(false);
            expect(r.reason).toBe("ROLLOUT_OUT");
        }
    });

    it("U-ST-05: percentage: 100 → always ROLLOUT_IN for any userId", () => {
        const s = new RolloutStrategy({ strategyType: "rollout", percentage: 100, hashAttribute: "userId" }, "flag-k");
        const users = ["alice", "bob", "charlie", "dave", "eve", "frank", "grace", "henry"];
        for (const id of users) {
            const r = s.evaluate({ userId: id });
            expect(r.value).toBe(true);
            expect(r.reason).toBe("ROLLOUT_IN");
        }
    });

    it("U-ST-06: percentage: 50, userId 'alice' → deterministic (same result on repeat calls)", () => {
        const s = new RolloutStrategy({ strategyType: "rollout", percentage: 50, hashAttribute: "userId" }, "rollout-test-flag");
        const r1 = s.evaluate({ userId: "alice" });
        const r2 = s.evaluate({ userId: "alice" });
        expect(r1.value).toBe(r2.value);
        expect(r1.reason).toBe(r2.reason);
    });

    it("U-ST-07: missing hashAttribute in config → StrategyValidationError at construction", () => {
        expect(() =>
            new RolloutStrategy({ strategyType: "rollout", percentage: 50, hashAttribute: "" }, "flag-k")
        ).toThrow(StrategyValidationError);
    });

    it("U-ST-08: hashAttribute field not present in context → MISSING_CONTEXT reason", () => {
        const s = new RolloutStrategy({ strategyType: "rollout", percentage: 50, hashAttribute: "userId" }, "flag-k");
        const r = s.evaluate({ plan: "pro" }); // no userId
        expect(r.value).toBe(false);
        expect(r.reason).toBe("MISSING_CONTEXT");
    });
});
