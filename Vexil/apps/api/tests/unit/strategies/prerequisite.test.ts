// Unit tests: PrerequisiteStrategy (U-ST-32..34)
import { describe, it, expect, vi } from "vitest";
import { PrerequisiteStrategy } from "../../../src/evaluation/strategies/PrerequisiteStrategy";

describe("PrerequisiteStrategy", () => {
    it("U-ST-32: prerequisite flag evaluates to expected value → true, PREREQUISITE_MET", async () => {
        const evaluator = vi.fn().mockResolvedValue({ value: true, reason: "ENABLED" });
        const s = new PrerequisiteStrategy(
            { strategyType: "prerequisite", flagKey: "base-flag", expectedValue: true },
            evaluator
        );
        const r = await s.evaluate({ userId: "alice" });
        expect(r.value).toBe(true);
        expect(r.reason).toBe("PREREQUISITE_MET");
        expect(evaluator).toHaveBeenCalledWith("base-flag", { userId: "alice" });
    });

    it("U-ST-33: prerequisite flag evaluates to different value → false, PREREQUISITE_UNMET", async () => {
        const evaluator = vi.fn().mockResolvedValue({ value: false, reason: "DISABLED" });
        const s = new PrerequisiteStrategy(
            { strategyType: "prerequisite", flagKey: "base-flag", expectedValue: true },
            evaluator
        );
        const r = await s.evaluate({ userId: "alice" });
        expect(r.value).toBe(false);
        expect(r.reason).toBe("PREREQUISITE_UNMET");
    });

    it("U-ST-34: evaluator returns null (depth limit hit) → false, PREREQUISITE_UNMET", async () => {
        const evaluator = vi.fn().mockResolvedValue(null);
        const s = new PrerequisiteStrategy(
            { strategyType: "prerequisite", flagKey: "base-flag", expectedValue: true },
            evaluator
        );
        const r = await s.evaluate({ userId: "alice" });
        expect(r.value).toBe(false);
        expect(r.reason).toBe("PREREQUISITE_UNMET");
    });
});
