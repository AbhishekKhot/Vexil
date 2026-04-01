import {
    RolloutConfig,
    EvaluationResult,
    IEvaluationStrategy,
    assertPercentage,
    assertNonEmptyString,
} from "../EvaluationStrategy.interface";
import { isInRollout } from "../hash.util";

export class RolloutStrategy implements IEvaluationStrategy {
    readonly strategyType = "rollout" as const;

    constructor(private readonly config: RolloutConfig, private readonly flagKey: string) {
        assertPercentage(config.percentage, "percentage");
        assertNonEmptyString(config.hashAttribute, "hashAttribute");
    }

    evaluate(context: Record<string, unknown>): EvaluationResult {
        const identifier = context[this.config.hashAttribute];

        if (typeof identifier !== "string" || identifier.trim().length === 0) {
            return { value: false, reason: "MISSING_CONTEXT" };
        }

        const inRollout = isInRollout(identifier, this.flagKey, this.config.percentage);
        return {
            value: inRollout,
            reason: inRollout ? "ROLLOUT_IN" : "ROLLOUT_OUT",
        };
    }
}
