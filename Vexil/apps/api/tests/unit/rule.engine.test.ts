// Unit tests: RuleEngine (U-RE-01..08)
import { describe, it, expect } from "vitest";
import { evaluateRules } from "../../src/utils/ruleEngine";

describe("RuleEngine.evaluateRules()", () => {
    it("U-RE-01: empty rules array → returns null (not false)", () => {
        expect(evaluateRules([], { userId: "alice" })).toBeNull();
    });

    it("U-RE-02: single passing rule (eq) → true", () => {
        const rules = [{ attribute: "plan", operator: "eq" as const, values: ["pro"] }];
        expect(evaluateRules(rules, { plan: "pro" })).toBe(true);
    });

    it("U-RE-03: single failing rule → false", () => {
        const rules = [{ attribute: "plan", operator: "eq" as const, values: ["pro"] }];
        expect(evaluateRules(rules, { plan: "free" })).toBe(false);
    });

    it("U-RE-04: two rules, both pass (AND) → true", () => {
        const rules = [
            { attribute: "plan", operator: "eq" as const, values: ["pro"] },
            { attribute: "country", operator: "eq" as const, values: ["US"] },
        ];
        expect(evaluateRules(rules, { plan: "pro", country: "US" })).toBe(true);
    });

    it("U-RE-05: two rules, first passes, second fails (AND) → false", () => {
        const rules = [
            { attribute: "plan", operator: "eq" as const, values: ["pro"] },
            { attribute: "country", operator: "eq" as const, values: ["US"] },
        ];
        expect(evaluateRules(rules, { plan: "pro", country: "DE" })).toBe(false);
    });

    it("U-RE-06: rule with 'in' operator → checks array membership", () => {
        const rules = [{ attribute: "country", operator: "in" as const, values: ["US", "CA", "GB"] }];
        expect(evaluateRules(rules, { country: "CA" })).toBe(true);
        expect(evaluateRules(rules, { country: "DE" })).toBe(false);
    });

    it("U-RE-07: attribute missing from context → false", () => {
        const rules = [{ attribute: "plan", operator: "eq" as const, values: ["pro"] }];
        expect(evaluateRules(rules, { country: "US" })).toBe(false);
    });

    it("U-RE-08: unknown operator → false (safe default)", () => {
        const rules = [{ attribute: "plan", operator: "unknown_op" as any, values: ["pro"] }];
        expect(evaluateRules(rules, { plan: "pro" })).toBe(false);
    });
});
