import { AbTestConfig, AbVariant, EvaluationResult, IEvaluationStrategy, StrategyValidationError, assertNonEmptyArray, assertNonEmptyString } from "../EvaluationStrategy.interface";
import { computeBucket } from "../hash.util";

/**
 * A/B test strategy — assigns users to named variants based on weighted buckets.
 * Variant weights must sum to 100. Assignment is sticky: same user + flag key
 * always lands in the same variant via deterministic hashing.
 */
export class AbTestStrategy implements IEvaluationStrategy {
    readonly strategyType = "ab_test" as const;
    constructor(private readonly config: AbTestConfig, private readonly flagKey: string) {
        assertNonEmptyArray(config.variants, "variants");
        assertNonEmptyString(config.hashAttribute, "hashAttribute");
        const total = config.variants.reduce((s, v) => s + v.weight, 0);
        if (Math.round(total) !== 100)
            throw new StrategyValidationError(`Variant weights must sum to 100. Got: ${total}`);
    }
    evaluate(context: Record<string, unknown>): EvaluationResult {
        const identifier = context[this.config.hashAttribute];
        // Missing identifier — fall back to first variant rather than erroring.
        if (typeof identifier !== "string" || !identifier.trim()) {
            const d = this.config.variants[0];
            return { value: d.value, variant: d.key, reason: "MISSING_CONTEXT" };
        }
        // Walk variants in order, accumulating weights. User's bucket falls into the
        // first variant whose cumulative weight exceeds it.
        const bucket = computeBucket(identifier, this.flagKey);
        let accumulated = 0;
        for (const variant of this.config.variants) {
            accumulated += variant.weight;
            if (bucket < accumulated)
                return { value: variant.value, variant: variant.key, reason: "AB_VARIANT" };
        }
        const last = this.config.variants[this.config.variants.length - 1];
        return { value: last.value, variant: last.key, reason: "AB_VARIANT" };
    }
}
