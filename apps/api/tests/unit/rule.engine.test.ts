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

    it("U-RE-09: 'contains' operator — substring present → true", () => {
        const rules = [{ attribute: "email", operator: "contains" as const, values: ["@acme.com"] }];
        expect(evaluateRules(rules, { email: "alice@acme.com" })).toBe(true);
    });

    it("U-RE-10: 'contains' operator — substring absent → false", () => {
        const rules = [{ attribute: "email", operator: "contains" as const, values: ["@acme.com"] }];
        expect(evaluateRules(rules, { email: "alice@other.com" })).toBe(false);
    });

    it("U-RE-11: 'gt' operator — value greater than threshold → true", () => {
        const rules = [{ attribute: "age", operator: "gt" as const, values: [18] }];
        expect(evaluateRules(rules, { age: 25 })).toBe(true);
        expect(evaluateRules(rules, { age: 18 })).toBe(false);
    });

    it("U-RE-12: 'lt' operator — value less than threshold → true", () => {
        const rules = [{ attribute: "score", operator: "lt" as const, values: [100] }];
        expect(evaluateRules(rules, { score: 50 })).toBe(true);
        expect(evaluateRules(rules, { score: 100 })).toBe(false);
    });
});
