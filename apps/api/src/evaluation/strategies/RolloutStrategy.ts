import { RolloutConfig, EvaluationResult, IEvaluationStrategy, assertPercentage, assertNonEmptyString } from "../EvaluationStrategy.interface";
import { isInRollout } from "../hash.util";

/**
 * Percentage rollout — deterministically assigns users to the rollout based on
 * a hash of their identifier + the flag key. The same user always gets the same result
 * for a given flag, and changing the percentage only affects users at the boundary.
 */
export class RolloutStrategy implements IEvaluationStrategy {
    readonly strategyType = "rollout" as const;
    constructor(private readonly config: RolloutConfig, private readonly flagKey: string) {
        assertPercentage(config.percentage, "percentage");
        assertNonEmptyString(config.hashAttribute, "hashAttribute");
    }
    evaluate(context: Record<string, unknown>): EvaluationResult {
        const identifier = context[this.config.hashAttribute];
        // Can't bucket an unknown user — return false rather than randomly including them.
        if (typeof identifier !== "string" || !identifier.trim())
            return { value: false, reason: "MISSING_CONTEXT" };
        const inRollout = isInRollout(identifier, this.flagKey, this.config.percentage);
        return { value: inRollout, reason: inRollout ? "ROLLOUT_IN" : "ROLLOUT_OUT" };
    }
}
