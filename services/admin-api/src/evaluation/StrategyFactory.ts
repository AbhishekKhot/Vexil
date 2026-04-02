/**
 * Strategy Factory
 *
 * Factory Pattern: Decouples strategy instantiation from the engine.
 * The engine never does `new RolloutStrategy(...)` directly — it always
 * goes through this factory, which validates the config schema and returns
 * the appropriate typed instance.
 *
 * Adding a new strategy: add a case here + a new class in strategies/.
 * The compiler+exhaustive-check ensures you can't forget either.
 */

import { IEvaluationStrategy, StrategyConfig, StrategyValidationError } from "./EvaluationStrategy.interface";
import { BooleanStrategy }           from "./strategies/BooleanStrategy";
import { RolloutStrategy }           from "./strategies/RolloutStrategy";
import { TargetedRolloutStrategy }   from "./strategies/TargetedRolloutStrategy";
import { UserTargetingStrategy }     from "./strategies/UserTargetingStrategy";
import { AttributeMatchingStrategy } from "./strategies/AttributeMatchingStrategy";
import { AbTestStrategy }            from "./strategies/AbTestStrategy";
import { TimeWindowStrategy }        from "./strategies/TimeWindowStrategy";
import { PrerequisiteStrategy, PrerequisiteEvaluator } from "./strategies/PrerequisiteStrategy";

export interface StrategyCreateOptions {
    /** Parsed strategy config from FlagEnvironmentConfig.strategyConfig */
    strategyConfig: StrategyConfig;
    /** The isEnabled value from FlagEnvironmentConfig (used by BooleanStrategy) */
    isEnabled: boolean;
    /** The flag key — used as a seed for hash-based strategies */
    flagKey: string;
    /** Injected evaluator for PrerequisiteStrategy — avoids circular imports */
    prerequisiteEvaluator?: PrerequisiteEvaluator;
}

export class StrategyFactory {
    /**
     * Creates the correct IEvaluationStrategy instance for the given config.
     * Throws StrategyValidationError if config is malformed.
     */
    static create(options: StrategyCreateOptions): IEvaluationStrategy {
        const { strategyConfig, isEnabled, flagKey, prerequisiteEvaluator } = options;

        switch (strategyConfig.strategyType) {
            case "boolean":
                return new BooleanStrategy(strategyConfig, isEnabled);

            case "rollout":
                return new RolloutStrategy(strategyConfig, flagKey);

            case "targeted_rollout":
                return new TargetedRolloutStrategy(strategyConfig, flagKey);

            case "user_targeting":
                return new UserTargetingStrategy(strategyConfig);

            case "attribute_matching":
                return new AttributeMatchingStrategy(strategyConfig);

            case "ab_test":
                return new AbTestStrategy(strategyConfig, flagKey);

            case "time_window":
                return new TimeWindowStrategy(strategyConfig);

            case "prerequisite":
                if (!prerequisiteEvaluator) {
                    throw new StrategyValidationError(
                        "prerequisiteEvaluator must be provided for the 'prerequisite' strategy"
                    );
                }
                return new PrerequisiteStrategy(strategyConfig, prerequisiteEvaluator);

            default:
                // Exhaustive check — TS will error here if a new strategy type is added
                // to the union but not handled in this switch.
                const _exhaustive: never = strategyConfig;
                throw new StrategyValidationError(
                    `Unknown strategy type: ${(_exhaustive as StrategyConfig).strategyType}`
                );
        }
    }

    /**
     * Validates a raw strategy config object (e.g., parsed from request body / DB JSON).
     * Returns a typed StrategyConfig or throws StrategyValidationError.
     */
    static parse(raw: unknown): StrategyConfig {
        if (!raw || typeof raw !== "object" || !("strategyType" in raw)) {
            throw new StrategyValidationError("strategyConfig must be an object with a strategyType field");
        }

        const config = raw as Record<string, unknown>;
        const type = config.strategyType as string;

        const validTypes = [
            "boolean", "rollout", "targeted_rollout", "user_targeting",
            "attribute_matching", "ab_test", "time_window", "prerequisite"
        ];

        if (!validTypes.includes(type)) {
            throw new StrategyValidationError(
                `Invalid strategyType "${type}". Valid values: ${validTypes.join(", ")}`
            );
        }

        // Type-specific presence checks (full validation happens inside strategy constructors)
        switch (type) {
            case "rollout":
            case "targeted_rollout":
                if (typeof config.percentage !== "number") {
                    throw new StrategyValidationError(`${type}: percentage is required and must be a number`);
                }
                break;
            case "user_targeting":
                if (!Array.isArray(config.userIds)) {
                    throw new StrategyValidationError("user_targeting: userIds must be an array");
                }
                break;
            case "attribute_matching":
            case "targeted_rollout":
                if (!Array.isArray(config.rules) || config.rules.length === 0) {
                    throw new StrategyValidationError(`${type}: rules must be a non-empty array`);
                }
                break;
            case "ab_test":
                if (!Array.isArray(config.variants)) {
                    throw new StrategyValidationError("ab_test: variants must be an array");
                }
                break;
            case "time_window":
                if (typeof config.startDate !== "string" || typeof config.endDate !== "string") {
                    throw new StrategyValidationError("time_window: startDate and endDate are required strings");
                }
                if (config.timezone !== undefined) {
                    if (typeof config.timezone !== "string") {
                        throw new StrategyValidationError("time_window: timezone must be a string");
                    }
                    try {
                        Intl.DateTimeFormat(undefined, { timeZone: config.timezone });
                    } catch (e) {
                        throw new StrategyValidationError(`time_window: invalid timezone "${config.timezone}"`);
                    }
                }
                break;
            case "prerequisite":
                if (typeof config.flagKey !== "string") {
                    throw new StrategyValidationError("prerequisite: flagKey must be a string");
                }
                break;
        }

        return raw as StrategyConfig;
    }
}
