import {
    AttributeMatchingConfig,
    EvaluationResult,
    IEvaluationStrategy,
    assertNonEmptyArray,
} from "../EvaluationStrategy.interface";
import { evaluateRules } from "../../utils/ruleEngine";

export class AttributeMatchingStrategy implements IEvaluationStrategy {
    readonly strategyType = "attribute_matching" as const;

    constructor(private readonly config: AttributeMatchingConfig) {
        assertNonEmptyArray(config.rules, "rules");
    }

    evaluate(context: Record<string, unknown>): EvaluationResult {
        const result = evaluateRules(this.config.rules, context as Record<string, unknown>);
        const matched = result === true;
        return {
            value: matched,
            reason: matched ? "ATTRIBUTE_MATCH" : "ATTRIBUTE_NO_MATCH",
        };
    }
}
