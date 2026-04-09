import { AttributeMatchingConfig, EvaluationResult, IEvaluationStrategy, assertNonEmptyArray } from "../EvaluationStrategy.interface";
import { evaluateRules } from "../../utils/ruleEngine";

/**
 * Attribute matching — enables the flag when all configured rules pass against the context.
 * Rules use AND logic (every rule must match). Useful for targeting by plan, country, role, etc.
 */
export class AttributeMatchingStrategy implements IEvaluationStrategy {
    readonly strategyType = "attribute_matching" as const;
    constructor(private readonly config: AttributeMatchingConfig) {
        assertNonEmptyArray(config.rules, "rules");
    }
    evaluate(context: Record<string, unknown>): EvaluationResult {
        const matched = evaluateRules(this.config.rules, context) === true;
        return { value: matched, reason: matched ? "ATTRIBUTE_MATCH" : "ATTRIBUTE_NO_MATCH" };
    }
}
