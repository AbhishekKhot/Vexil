export type RuleOperator = "in" | "not_in" | "eq" | "neq" | "contains" | "gt" | "lt";

export interface Rule {
    attribute: string;
    operator: RuleOperator;
    values: unknown[];
}

/** Evaluates a single rule against the request context. Returns false if the attribute is missing. */
function evaluateSingleRule(rule: Rule, context: Record<string, unknown>): boolean {
    const v = context[rule.attribute];
    if (v === undefined || v === null) return false;
    switch (rule.operator) {
        case "in": return rule.values.includes(v);
        case "not_in": return !rule.values.includes(v);
        case "eq": return v === rule.values[0];
        case "neq": return v !== rule.values[0];
        case "contains": return String(v).includes(String(rule.values[0]));
        case "gt": return Number(v) > Number(rule.values[0]);
        case "lt": return Number(v) < Number(rule.values[0]);
        default: return false;
    }
}

/**
 * Evaluates all rules with AND logic — every rule must pass.
 * Returns null (not false) when there are no rules, so callers can distinguish
 * "no rules configured" from "rules evaluated and failed".
 */
export function evaluateRules(rules: unknown, context: Record<string, unknown>): boolean | null {
    if (!rules || !Array.isArray(rules) || rules.length === 0) return null;
    return rules.every((rule: Rule) => evaluateSingleRule(rule, context));
}
