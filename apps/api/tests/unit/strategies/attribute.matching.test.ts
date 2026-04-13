// Unit tests: AttributeMatchingStrategy (U-ST-19..25)
import { describe, it, expect } from "vitest";
import { AttributeMatchingStrategy } from "../../../src/evaluation/strategies/AttributeMatchingStrategy";
import { StrategyValidationError } from "../../../src/evaluation/EvaluationStrategy.interface";

describe("AttributeMatchingStrategy", () => {
    it("U-ST-19: eq rule matches → true, reason ATTRIBUTE_MATCH", () => {
        const s = new AttributeMatchingStrategy({
            strategyType: "attribute_matching",
            rules: [{ attribute: "plan", operator: "eq", values: ["pro"] }],
        });
        const r = s.evaluate({ plan: "pro" });
        expect(r.value).toBe(true);
        expect(r.reason).toBe("ATTRIBUTE_MATCH");
    });

    it("U-ST-20: neq rule matches → true", () => {
        const s = new AttributeMatchingStrategy({
            strategyType: "attribute_matching",
            rules: [{ attribute: "plan", operator: "neq", values: ["free"] }],
        });
        const r = s.evaluate({ plan: "pro" });
        expect(r.value).toBe(true);
    });

    it("U-ST-21: in rule, value in array → true", () => {
        const s = new AttributeMatchingStrategy({
            strategyType: "attribute_matching",
            rules: [{ attribute: "country", operator: "in", values: ["US", "CA", "GB"] }],
        });
        expect(s.evaluate({ country: "CA" }).value).toBe(true);
    });

    it("U-ST-22: nin rule, value not in array → true", () => {
        const s = new AttributeMatchingStrategy({
            strategyType: "attribute_matching",
            rules: [{ attribute: "country", operator: "not_in", values: ["CN", "RU"] }],
        });
        expect(s.evaluate({ country: "US" }).value).toBe(true);
        expect(s.evaluate({ country: "CN" }).value).toBe(false);
    });

    it("U-ST-23: gt / lt numeric comparison → correct boolean", () => {
        const gtStrategy = new AttributeMatchingStrategy({
            strategyType: "attribute_matching",
            rules: [{ attribute: "age", operator: "gt", values: [18] }],
        });
        expect(gtStrategy.evaluate({ age: 21 }).value).toBe(true);
        expect(gtStrategy.evaluate({ age: 16 }).value).toBe(false);

        const ltStrategy = new AttributeMatchingStrategy({
            strategyType: "attribute_matching",
            rules: [{ attribute: "age", operator: "lt", values: [18] }],
        });
        expect(ltStrategy.evaluate({ age: 16 }).value).toBe(true);
        expect(ltStrategy.evaluate({ age: 21 }).value).toBe(false);
    });

    it("U-ST-24: all rules pass (AND) → true; one rule fails → false", () => {
        const s = new AttributeMatchingStrategy({
            strategyType: "attribute_matching",
            rules: [
                { attribute: "plan", operator: "eq", values: ["pro"] },
                { attribute: "country", operator: "eq", values: ["US"] },
            ],
        });
        expect(s.evaluate({ plan: "pro", country: "US" }).value).toBe(true);
        expect(s.evaluate({ plan: "pro", country: "DE" }).value).toBe(false);
    });

    it("U-ST-25: empty rules array → StrategyValidationError at construction", () => {
        expect(() =>
            new AttributeMatchingStrategy({ strategyType: "attribute_matching", rules: [] })
        ).toThrow(StrategyValidationError);
    });
});
