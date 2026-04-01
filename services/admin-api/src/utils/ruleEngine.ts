/**
 * Vexil Rule Engine
 * Evaluates a list of targeting rules against a user context object.
 * 
 * Rule schema:
 *   { "attribute": "country", "operator": "in", "values": ["US", "CA"] }
 * 
 * Supported operators: in, not_in, eq, neq, contains, gt, lt
 * 
 * Evaluation logic:
 *   - ALL rules must pass for the user to receive the flag (AND logic)
 *   - If rules is empty/null → returns null (caller uses isEnabled directly)
 *   - If context attribute is missing → rule fails
 */

export type RuleOperator = "in" | "not_in" | "eq" | "neq" | "contains" | "gt" | "lt";

export interface Rule {
    attribute: string;
    operator: RuleOperator;
    values: any[];
}

function evaluateSingleRule(rule: Rule, context: Record<string, any>): boolean {
    const contextValue = context[rule.attribute];

    // Missing attribute → rule fails
    if (contextValue === undefined || contextValue === null) return false;

    switch (rule.operator) {
        case "in":
            return rule.values.includes(contextValue);
        case "not_in":
            return !rule.values.includes(contextValue);
        case "eq":
            return contextValue === rule.values[0];
        case "neq":
            return contextValue !== rule.values[0];
        case "contains":
            return String(contextValue).includes(String(rule.values[0]));
        case "gt":
            return Number(contextValue) > Number(rule.values[0]);
        case "lt":
            return Number(contextValue) < Number(rule.values[0]);
        default:
            return false;
    }
}

/**
 * Evaluates all rules against a context.
 * @returns true if all rules pass, false if any fail, null if no rules (use isEnabled directly)
 */
export function evaluateRules(rules: any, context: Record<string, any>): boolean | null {
    if (!rules || !Array.isArray(rules) || rules.length === 0) {
        return null; // No rules — caller uses isEnabled directly
    }
    return rules.every((rule: Rule) => evaluateSingleRule(rule, context));
}
