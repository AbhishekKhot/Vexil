import { IEvaluationStrategy, StrategyConfig, StrategyValidationError } from "./EvaluationStrategy.interface";
import { BooleanStrategy } from "./strategies/BooleanStrategy";
import { RolloutStrategy } from "./strategies/RolloutStrategy";
import { TargetedRolloutStrategy } from "./strategies/TargetedRolloutStrategy";
import { UserTargetingStrategy } from "./strategies/UserTargetingStrategy";
import { AttributeMatchingStrategy } from "./strategies/AttributeMatchingStrategy";
import { AbTestStrategy } from "./strategies/AbTestStrategy";
import { TimeWindowStrategy } from "./strategies/TimeWindowStrategy";
import { PrerequisiteStrategy, PrerequisiteEvaluator } from "./strategies/PrerequisiteStrategy";

export interface StrategyCreateOptions {
    strategyConfig: StrategyConfig;
    isEnabled: boolean;
    flagKey: string;
    /** Required only for prerequisite strategy — injects the recursive evaluator to avoid circular deps. */
    prerequisiteEvaluator?: PrerequisiteEvaluator;
}

export class StrategyFactory {
    /**
     * Instantiates the correct strategy class for a given config.
     * Strategy constructors run validation, so this throws StrategyValidationError
     * if the config is invalid — callers should catch and return ERROR reason.
     */
    static create(options: StrategyCreateOptions): IEvaluationStrategy {
        const { strategyConfig, isEnabled, flagKey, prerequisiteEvaluator } = options;
        switch (strategyConfig.strategyType) {
            case "boolean": return new BooleanStrategy(strategyConfig, isEnabled);
            case "rollout": return new RolloutStrategy(strategyConfig, flagKey);
            case "targeted_rollout": return new TargetedRolloutStrategy(strategyConfig, flagKey);
            case "user_targeting": return new UserTargetingStrategy(strategyConfig);
            case "attribute_matching": return new AttributeMatchingStrategy(strategyConfig);
            case "ab_test": return new AbTestStrategy(strategyConfig, flagKey);
            case "time_window": return new TimeWindowStrategy(strategyConfig);
            case "prerequisite":
                if (!prerequisiteEvaluator) throw new StrategyValidationError("prerequisiteEvaluator required for prerequisite strategy");
                return new PrerequisiteStrategy(strategyConfig, prerequisiteEvaluator);
            default:
                const _e: never = strategyConfig;
                throw new StrategyValidationError(`Unknown strategy type: ${(_e as StrategyConfig).strategyType}`);
        }
    }

    /**
     * Validates and casts raw JSON (from DB or API request) into a typed StrategyConfig.
     * Called at save-time in FlagConfigService — errors surface as 400 to the UI.
     * Only checks required fields; deep value validation happens inside each strategy constructor.
     */
    static parse(raw: unknown): StrategyConfig {
        if (!raw || typeof raw !== "object" || !("strategyType" in raw))
            throw new StrategyValidationError("strategyConfig must have a strategyType field");
        const config = raw as Record<string, unknown>;
        const type = config.strategyType as string;
        const validTypes = ["boolean", "rollout", "targeted_rollout", "user_targeting", "attribute_matching", "ab_test", "time_window", "prerequisite"];
        if (!validTypes.includes(type))
            throw new StrategyValidationError(`Invalid strategyType "${type}". Valid: ${validTypes.join(", ")}`);
        switch (type) {
            case "rollout": case "targeted_rollout":
                if (typeof config.percentage !== "number") throw new StrategyValidationError(`${type}: percentage required`); break;
            case "user_targeting":
                if (!Array.isArray(config.userIds)) throw new StrategyValidationError("user_targeting: userIds must be array"); break;
            case "attribute_matching":
                if (!Array.isArray(config.rules) || !config.rules.length) throw new StrategyValidationError("attribute_matching: rules must be non-empty array"); break;
            case "ab_test":
                if (!Array.isArray(config.variants)) throw new StrategyValidationError("ab_test: variants must be array"); break;
            case "time_window":
                if (typeof config.startDate !== "string" || typeof config.endDate !== "string")
                    throw new StrategyValidationError("time_window: startDate and endDate required"); break;
            case "prerequisite":
                if (typeof config.flagKey !== "string") throw new StrategyValidationError("prerequisite: flagKey required"); break;
        }
        return raw as StrategyConfig;
    }
}
