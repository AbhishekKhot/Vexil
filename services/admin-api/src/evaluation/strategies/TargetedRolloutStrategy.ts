import {
    TargetedRolloutConfig,
    EvaluationResult,
    IEvaluationStrategy,
    assertPercentage,
    assertNonEmptyString,
    assertNonEmptyArray,
} from "../EvaluationStrategy.interface";
import { isInRollout } from "../hash.util";
import { evaluateRules } from "../../utils/ruleEngine";

export class TargetedRolloutStrategy implements IEvaluationStrategy {
    readonly strategyType = "targeted_rollout" as const;

    constructor(private readonly config: TargetedRolloutConfig, private readonly flagKey: string) {
        assertPercentage(config.percentage, "percentage");
        assertNonEmptyString(config.hashAttribute, "hashAttribute");
        assertNonEmptyArray(config.rules, "rules");
    }

    evaluate(context: Record<string, unknown>): EvaluationResult {
        // Step 1: Check if the user matches the segment rules (AND logic)
        const rulesPass = evaluateRules(this.config.rules, context as Record<string, unknown>);
        if (rulesPass === false || rulesPass === null) {
            return { value: false, reason: "TARGETED_OUT" };
        }

        // Step 2: Within the matching segment, apply percentage rollout
        const identifier = context[this.config.hashAttribute];
        if (typeof identifier !== "string" || identifier.trim().length === 0) {
            return { value: false, reason: "MISSING_CONTEXT" };
        }

        const inRollout = isInRollout(identifier, this.flagKey, this.config.percentage);
        return {
            value: inRollout,
            reason: inRollout ? "TARGETED_IN" : "TARGETED_OUT",
        };
    }
}
