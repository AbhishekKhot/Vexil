/**
 * @vexil/types — Shared TypeScript types for Vexil admin-api and admin-ui.
 *
 * Import in admin-api: import type { StrategyType, FlagResult } from "@vexil/types";
 * Import in admin-ui:  import type { StrategyType, FlagResult } from "@vexil/types";
 */

// ─────────────────────────────────────────────────────────────────────────────
// Evaluation context
// ─────────────────────────────────────────────────────────────────────────────

export type EvaluationContext = Record<string, unknown>;

// ─────────────────────────────────────────────────────────────────────────────
// Strategy types
// ─────────────────────────────────────────────────────────────────────────────

export type StrategyType =
  | "boolean"
  | "rollout"
  | "targeted_rollout"
  | "user_targeting"
  | "attribute_matching"
  | "ab_test"
  | "time_window"
  | "prerequisite";

export type RuleOperator = "in" | "not_in" | "eq" | "neq" | "contains" | "gt" | "lt";

export interface TargetingRule {
  attribute: string;
  operator: RuleOperator;
  values: (string | number | boolean)[];
}

export interface AbVariant {
  key: string;
  value: unknown;
  weight: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Strategy configs
// ─────────────────────────────────────────────────────────────────────────────

export interface BooleanConfig {
  strategyType: "boolean";
}

export interface RolloutConfig {
  strategyType: "rollout";
  percentage: number;
  hashAttribute: string;
}

export interface TargetedRolloutConfig {
  strategyType: "targeted_rollout";
  percentage: number;
  hashAttribute: string;
  rules: TargetingRule[];
}

export interface UserTargetingConfig {
  strategyType: "user_targeting";
  userIds: string[];
  hashAttribute: string;
  fallthrough: boolean;
}

export interface AttributeMatchingConfig {
  strategyType: "attribute_matching";
  rules: TargetingRule[];
}

export interface AbTestConfig {
  strategyType: "ab_test";
  variants: AbVariant[];
  hashAttribute: string;
}

export interface TimeWindowConfig {
  strategyType: "time_window";
  startDate: string;
  endDate: string;
  timezone?: string;
}

export interface PrerequisiteConfig {
  strategyType: "prerequisite";
  flagKey: string;
  expectedValue: unknown;
}

export type StrategyConfig =
  | BooleanConfig
  | RolloutConfig
  | TargetedRolloutConfig
  | UserTargetingConfig
  | AttributeMatchingConfig
  | AbTestConfig
  | TimeWindowConfig
  | PrerequisiteConfig;

// ─────────────────────────────────────────────────────────────────────────────
// Evaluation result
// ─────────────────────────────────────────────────────────────────────────────

export type EvaluationReason =
  | "DISABLED"
  | "ENABLED"
  | "ROLLOUT_IN"
  | "ROLLOUT_OUT"
  | "TARGETED_IN"
  | "TARGETED_OUT"
  | "USER_WHITELIST"
  | "USER_FALLTHROUGH"
  | "ATTRIBUTE_MATCH"
  | "ATTRIBUTE_NO_MATCH"
  | "AB_VARIANT"
  | "TIME_WINDOW_ACTIVE"
  | "TIME_WINDOW_INACTIVE"
  | "PREREQUISITE_MET"
  | "PREREQUISITE_UNMET"
  | "MISSING_CONTEXT"
  | "ERROR";

export interface FlagResult {
  value: unknown;
  type: string;
  variant?: string;
  reason: EvaluationReason;
}

export type FlagResultMap = Record<string, FlagResult>;

// ─────────────────────────────────────────────────────────────────────────────
// Flag config (as stored / transferred)
// ─────────────────────────────────────────────────────────────────────────────

export interface FlagConfig {
  id: string;
  flagKey: string;
  flagType: string;
  isEnabled: boolean;
  strategyType: StrategyType;
  strategyConfig?: StrategyConfig;
  scheduledAt?: string;
  scheduledConfig?: Partial<FlagConfig>;
}
