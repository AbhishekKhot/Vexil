import {
    UserTargetingConfig,
    EvaluationResult,
    IEvaluationStrategy,
    assertNonEmptyString,
    assertNonEmptyArray,
    StrategyValidationError,
} from "../EvaluationStrategy.interface";

export class UserTargetingStrategy implements IEvaluationStrategy {
    readonly strategyType = "user_targeting" as const;

    constructor(private readonly config: UserTargetingConfig) {
        assertNonEmptyString(config.hashAttribute, "hashAttribute");
        assertNonEmptyArray(config.userIds, "userIds");
        if (typeof config.fallthrough !== "boolean") {
            throw new StrategyValidationError("fallthrough must be a boolean");
        }
    }

    evaluate(context: Record<string, unknown>): EvaluationResult {
        const identifier = context[this.config.hashAttribute];
        if (typeof identifier !== "string" || identifier.trim().length === 0) {
            return { value: this.config.fallthrough, reason: "MISSING_CONTEXT" };
        }

        const inWhitelist = this.config.userIds.includes(identifier);
        if (inWhitelist) {
            return { value: true, reason: "USER_WHITELIST" };
        }

        return { value: this.config.fallthrough, reason: "USER_FALLTHROUGH" };
    }
}
