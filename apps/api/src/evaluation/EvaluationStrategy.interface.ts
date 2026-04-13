// Core interfaces and shared validation helpers for the evaluation engine.
// Every strategy implements IEvaluationStrategy — this file is the contract
// all strategies must satisfy.

export type RuleOperator = "in" | "not_in" | "eq" | "neq" | "contains" | "gt" | "lt";

export interface TargetingRule {
    attribute: string;   // context key to inspect (e.g. "country", "plan")
    operator: RuleOperator;
    values: (string | number | boolean)[];
}

export interface AbVariant { key: string; value: unknown; weight: number }

// One interface per strategy type — strategyType acts as the discriminant
// so TypeScript can narrow configs in switch statements.
export interface BooleanConfig { strategyType: "boolean" }
export interface RolloutConfig { strategyType: "rollout"; percentage: number; hashAttribute: string }
export interface TargetedRolloutConfig { strategyType: "targeted_rollout"; percentage: number; hashAttribute: string; rules: TargetingRule[] }
export interface UserTargetingConfig { strategyType: "user_targeting"; userIds: string[]; hashAttribute: string; fallthrough: boolean }
export interface AttributeMatchingConfig { strategyType: "attribute_matching"; rules: TargetingRule[] }
export interface AbTestConfig { strategyType: "ab_test"; variants: AbVariant[]; hashAttribute: string }
export interface TimeWindowConfig { strategyType: "time_window"; startDate: string; endDate: string; timezone?: string }
export interface PrerequisiteConfig { strategyType: "prerequisite"; flagKey: string; expectedValue: unknown }

export type StrategyConfig =
    | BooleanConfig | RolloutConfig | TargetedRolloutConfig | UserTargetingConfig
    | AttributeMatchingConfig | AbTestConfig | TimeWindowConfig | PrerequisiteConfig;

export type StrategyType = StrategyConfig["strategyType"];

// reason tells the caller *why* a flag resolved the way it did —
// used for analytics, debugging, and SDK consumers.
export type EvaluationReason =
    | "DISABLED" | "ENABLED" | "ROLLOUT_IN" | "ROLLOUT_OUT"
    | "TARGETED_IN" | "TARGETED_OUT" | "USER_WHITELIST" | "USER_FALLTHROUGH"
    | "ATTRIBUTE_MATCH" | "ATTRIBUTE_NO_MATCH" | "AB_VARIANT"
    | "TIME_WINDOW_ACTIVE" | "TIME_WINDOW_INACTIVE"
    | "PREREQUISITE_MET" | "PREREQUISITE_UNMET" | "MISSING_CONTEXT" | "ERROR";

export interface EvaluationResult {
    value: unknown;
    variant?: string;  // only set by A/B test strategy
    reason: EvaluationReason;
}

/** Contract every strategy must implement. evaluate() is called per request with the user context. */
export interface IEvaluationStrategy {
    readonly strategyType: StrategyType;
    evaluate(context: Record<string, unknown>): EvaluationResult | Promise<EvaluationResult>;
}

/** Thrown during config parsing/validation — surfaces as a 400 to the control plane. */
export class StrategyValidationError extends Error {
    constructor(message: string) {
        super(`[StrategyValidation] ${message}`);
        this.name = "StrategyValidationError";
    }
}

// Guard helpers — throw StrategyValidationError so callers don't need to repeat the check logic.

export function assertPercentage(value: unknown, field: string): void {
    if (typeof value !== "number" || value < 0 || value > 100)
        throw new StrategyValidationError(`${field} must be a number between 0 and 100`);
}

export function assertNonEmptyString(value: unknown, field: string): void {
    if (typeof value !== "string" || value.trim().length === 0)
        throw new StrategyValidationError(`${field} must be a non-empty string`);
}

export function assertNonEmptyArray(value: unknown, field: string): void {
    if (!Array.isArray(value) || value.length === 0)
        throw new StrategyValidationError(`${field} must be a non-empty array`);
}
