// Unit tests: TargetedRolloutStrategy (U-ST-26..28)
import { describe, it, expect } from "vitest";
import { TargetedRolloutStrategy } from "../../../src/evaluation/strategies/TargetedRolloutStrategy";

const proUsRule = [{ attribute: "plan", operator: "eq" as const, values: ["pro"] }];

describe("TargetedRolloutStrategy", () => {
    it("U-ST-26: rules fail → TARGETED_OUT regardless of bucket", () => {
        const s = new TargetedRolloutStrategy(
            { strategyType: "targeted_rollout", percentage: 100, hashAttribute: "userId", rules: proUsRule },
            "flag-k"
        );
        // user on 'free' plan fails the rule — should not enter rollout even at 100%
        const r = s.evaluate({ userId: "alice", plan: "free" });
        expect(r.value).toBe(false);
        expect(r.reason).toBe("TARGETED_OUT");
    });

    it("U-ST-27: rules pass, percentage 100 → TARGETED_IN", () => {
        const s = new TargetedRolloutStrategy(
            { strategyType: "targeted_rollout", percentage: 100, hashAttribute: "userId", rules: proUsRule },
            "flag-k"
        );
        const r = s.evaluate({ userId: "alice", plan: "pro" });
        expect(r.value).toBe(true);
        expect(r.reason).toBe("TARGETED_IN");
    });

    it("U-ST-28: rules pass, percentage 0 → TARGETED_OUT", () => {
        const s = new TargetedRolloutStrategy(
            { strategyType: "targeted_rollout", percentage: 0, hashAttribute: "userId", rules: proUsRule },
            "flag-k"
        );
        const users = ["alice", "bob", "charlie"];
        for (const id of users) {
            const r = s.evaluate({ userId: id, plan: "pro" });
            expect(r.value).toBe(false);
            expect(r.reason).toBe("TARGETED_OUT");
        }
    });

    it("U-ST-29: rules pass but hashAttribute missing in context → MISSING_CONTEXT", () => {
        const s = new TargetedRolloutStrategy(
            { strategyType: "targeted_rollout", percentage: 100, hashAttribute: "userId", rules: proUsRule },
            "flag-k"
        );
        // plan matches rule but userId is absent
        const r = s.evaluate({ plan: "pro" });
        expect(r.value).toBe(false);
        expect(r.reason).toBe("MISSING_CONTEXT");
    });
});
