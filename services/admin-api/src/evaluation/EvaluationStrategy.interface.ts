/**
 * Evaluation Strategy Contracts
 *
 * Defines the discriminated union of all strategy config types and the
 * IEvaluationStrategy interface that every strategy must implement.
 *
 * Design pattern: Strategy + Discriminated Union
 * - Adding a new strategy = add one type here + one file in strategies/
 * - The compiler enforces exhaustive handling via the union
 */

// ─────────────────────────────────────────────────────────────────────────────
// Shared Building Blocks
// ─────────────────────────────────────────────────────────────────────────────

export type RuleOperator = "in" | "not_in" | "eq" | "neq" | "contains" | "gt" | "lt";

export interface TargetingRule {
    attribute: string;
    operator: RuleOperator;
    values: (string | number | boolean)[];
}

export interface AbVariant {
    key: string;           // e.g., "control", "variant-a"
    value: unknown;        // The raw flag value returned for this variant
    weight: number;        // 0–100, all variant weights in a flag must sum to 100
}

// ─────────────────────────────────────────────────────────────────────────────
// Strategy Config Types (Discriminated Union)
// ─────────────────────────────────────────────────────────────────────────────

/** 1. Kill switch — global on/off, no context needed */
export interface BooleanConfig {
    strategyType: "boolean";
}

/**
 * 2. Percentage rollout — routes X% of ALL users.
 * Hash is computed from context[hashAttribute] + flagKey.
 */
export interface RolloutConfig {
    strategyType: "rollout";
    percentage: number;       // 0–100
    hashAttribute: string;    // context key to use as identifier (default: "userId")
}

/**
 * 3. Targeted rollout — routes X% of users who ALSO match the given rules.
 * Think: "20% of users where country = 'US' or org = 'acme'".
 */
export interface TargetedRolloutConfig {
    strategyType: "targeted_rollout";
    percentage: number;
    hashAttribute: string;
    rules: TargetingRule[];  // ALL rules must pass (AND logic)
}

/**
 * 4. User targeting — explicit allow-list; other users get `fallthrough` value.
 * Useful for internal testers, VIP customers, support accounts.
 */
export interface UserTargetingConfig {
    strategyType: "user_targeting";
    userIds: string[];        // Users that explicitly receive the flag
    hashAttribute: string;   // context key holding the user identifier (default: "userId")
    fallthrough: boolean;    // Value for users NOT in the list
}

/**
 * 5. Attribute matching — pure rule evaluation, binary result.
 * Examples: "all premium plan users", "users in US or CA".
 */
export interface AttributeMatchingConfig {
    strategyType: "attribute_matching";
    rules: TargetingRule[];  // ALL rules must pass (AND logic)
}

/**
 * 6. A/B test — splits users deterministically into weighted variants.
 * Returns the variant's value rather than a boolean.
 * All variant weights must sum to exactly 100.
 */
export interface AbTestConfig {
    strategyType: "ab_test";
    variants: AbVariant[];   // weighted buckets summing to 100
    hashAttribute: string;   // context key used for deterministic assignment
}

/**
 * 7. Time window — flag is active only between startDate and endDate (UTC).
 * Useful for scheduled launches, seasonal features, maintenance windows.
 */
export interface TimeWindowConfig {
    strategyType: "time_window";
    startDate: string;       // ISO 8601 UTC string, e.g., "2024-01-15T09:00:00Z"
    endDate:   string;       // ISO 8601 UTC string
}

/**
 * 8. Prerequisite — flag is active only if another flag evaluates to an expected value.
 * Prevents a feature from being visible before its dependency is ready.
 * Max recursion depth enforced by EvaluationEngine to prevent cycles.
 */
export interface PrerequisiteConfig {
    strategyType: "prerequisite";
    flagKey: string;         // Key of the prerequisite flag (same project)
    expectedValue: unknown;  // The value the prerequisite must evaluate to
}

/** Discriminated union of all strategy configs */
export type StrategyConfig =
    | BooleanConfig
    | RolloutConfig
    | TargetedRolloutConfig
    | UserTargetingConfig
    | AttributeMatchingConfig
    | AbTestConfig
    | TimeWindowConfig
    | PrerequisiteConfig;

export type StrategyType = StrategyConfig["strategyType"];

// ─────────────────────────────────────────────────────────────────────────────
// Evaluation Result
// ─────────────────────────────────────────────────────────────────────────────

export interface EvaluationResult {
    value: unknown;           // The resolved flag value (boolean, string, number, object)
    variant?: string;         // For ab_test: the variant key assigned
    reason: EvaluationReason; // Why this result was returned (for debugging/analytics)
}

export type EvaluationReason =
    | "DISABLED"           // Kill switch off
    | "ENABLED"            // Kill switch on
    | "ROLLOUT_IN"         // User falls inside rollout bucket
    | "ROLLOUT_OUT"        // User falls outside rollout bucket
    | "TARGETED_IN"        // User matches rules and rollout
    | "TARGETED_OUT"       // User doesn't match rules or rollout
    | "USER_WHITELIST"     // User explicitly in the user_targeting list
    | "USER_FALLTHROUGH"   // User not in list, fallthrough value returned
    | "ATTRIBUTE_MATCH"    // All rules matched
    | "ATTRIBUTE_NO_MATCH" // One or more rules failed
    | "AB_VARIANT"         // User assigned to A/B variant
    | "TIME_WINDOW_ACTIVE" // Current time is within window
    | "TIME_WINDOW_INACTIVE" // Current time is outside window
    | "PREREQUISITE_MET"   // Prerequisite flag has expected value
    | "PREREQUISITE_UNMET" // Prerequisite flag doesn't have expected value
    | "MISSING_CONTEXT"    // Required context attribute is missing
    | "ERROR";             // Unexpected error during evaluation

// ─────────────────────────────────────────────────────────────────────────────
// Strategy Interface
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Every evaluation strategy implements this interface.
 * The `evaluate` method is pure from the strategy's perspective —
 * side effects (logging, caching) live in EvaluationEngine.
 */
export interface IEvaluationStrategy {
    readonly strategyType: StrategyType;
    evaluate(context: Record<string, unknown>): EvaluationResult | Promise<EvaluationResult>;
}

// ─────────────────────────────────────────────────────────────────────────────
// Validation Helpers
// ─────────────────────────────────────────────────────────────────────────────

export class StrategyValidationError extends Error {
    constructor(message: string) {
        super(`[StrategyValidation] ${message}`);
        this.name = "StrategyValidationError";
    }
}

export function assertPercentage(value: unknown, field: string): void {
    if (typeof value !== "number" || value < 0 || value > 100) {
        throw new StrategyValidationError(`${field} must be a number between 0 and 100`);
    }
}

export function assertNonEmptyString(value: unknown, field: string): void {
    if (typeof value !== "string" || value.trim().length === 0) {
        throw new StrategyValidationError(`${field} must be a non-empty string`);
    }
}

export function assertNonEmptyArray(value: unknown, field: string): void {
    if (!Array.isArray(value) || value.length === 0) {
        throw new StrategyValidationError(`${field} must be a non-empty array`);
    }
}
