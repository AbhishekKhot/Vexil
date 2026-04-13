// Unit tests: BooleanStrategy (U-ST-01..03)
import { describe, it, expect } from "vitest";
import { BooleanStrategy } from "../../../src/evaluation/strategies/BooleanStrategy";
import { StrategyValidationError } from "../../../src/evaluation/EvaluationStrategy.interface";

describe("BooleanStrategy", () => {
    it("U-ST-01: value: true → result true, reason ENABLED", () => {
        const s = new BooleanStrategy({ strategyType: "boolean" }, true);
        const result = s.evaluate({});
        expect(result.value).toBe(true);
        expect(result.reason).toBe("ENABLED");
    });

    it("U-ST-02: value: false (isEnabled=false) → result false, reason DISABLED", () => {
        const s = new BooleanStrategy({ strategyType: "boolean" }, false);
        const result = s.evaluate({});
        expect(result.value).toBe(false);
        expect(result.reason).toBe("DISABLED");
    });

    it("U-ST-03: BooleanStrategy ignores context entirely", () => {
        const s = new BooleanStrategy({ strategyType: "boolean" }, true);
        const r1 = s.evaluate({ userId: "alice" });
        const r2 = s.evaluate({});
        expect(r1.value).toBe(r2.value);
    });
});
