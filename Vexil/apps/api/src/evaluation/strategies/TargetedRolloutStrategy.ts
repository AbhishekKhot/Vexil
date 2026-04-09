import { TargetedRolloutConfig, EvaluationResult, IEvaluationStrategy, assertPercentage, assertNonEmptyString, assertNonEmptyArray } from "../EvaluationStrategy.interface";
import { isInRollout } from "../hash.util";
import { evaluateRules } from "../../utils/ruleEngine";

/**
 * Targeted rollout — combines attribute rules with percentage rollout.
 * Only users who pass the rules are eligible for the rollout bucket check.
 * This lets you gradually roll out to a segment (e.g. "50% of pro users in US").
 */
export class TargetedRolloutStrategy implements IEvaluationStrategy {
    readonly strategyType = "targeted_rollout" as const;
    constructor(private readonly config: TargetedRolloutConfig, private readonly flagKey: string) {
        assertPercentage(config.percentage, "percentage");
        assertNonEmptyString(config.hashAttribute, "hashAttribute");
        assertNonEmptyArray(config.rules, "rules");
    }
    evaluate(context: Record<string, unknown>): EvaluationResult {
        // Gate 1: attribute rules — if they don't match, user is excluded entirely.
        const rulesPass = evaluateRules(this.config.rules, context);
        if (!rulesPass) return { value: false, reason: "TARGETED_OUT" };
        // Gate 2: percentage bucket — only applies to users who passed the rules.
        const identifier = context[this.config.hashAttribute];
        if (typeof identifier !== "string" || !identifier.trim())
            return { value: false, reason: "MISSING_CONTEXT" };
        const inRollout = isInRollout(identifier, this.flagKey, this.config.percentage);
        return { value: inRollout, reason: inRollout ? "TARGETED_IN" : "TARGETED_OUT" };
    }
}
