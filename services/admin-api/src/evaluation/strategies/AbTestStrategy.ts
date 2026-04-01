import {
    AbTestConfig,
    AbVariant,
    EvaluationResult,
    IEvaluationStrategy,
    StrategyValidationError,
    assertNonEmptyArray,
    assertNonEmptyString,
} from "../EvaluationStrategy.interface";
import { computeBucket } from "../hash.util";

function validateVariants(variants: AbVariant[]): void {
    const totalWeight = variants.reduce((sum, v) => sum + v.weight, 0);
    if (Math.round(totalWeight) !== 100) {
        throw new StrategyValidationError(
            `Variant weights must sum to 100. Current sum: ${totalWeight}`
        );
    }
    for (const v of variants) {
        if (typeof v.key !== "string" || v.key.trim().length === 0) {
            throw new StrategyValidationError("Each variant must have a non-empty key");
        }
        if (v.weight < 0 || v.weight > 100) {
            throw new StrategyValidationError(`Variant "${v.key}" has invalid weight: ${v.weight}`);
        }
    }
}

export class AbTestStrategy implements IEvaluationStrategy {
    readonly strategyType = "ab_test" as const;

    constructor(private readonly config: AbTestConfig, private readonly flagKey: string) {
        assertNonEmptyArray(config.variants, "variants");
        assertNonEmptyString(config.hashAttribute, "hashAttribute");
        validateVariants(config.variants);
    }

    evaluate(context: Record<string, unknown>): EvaluationResult {
        const identifier = context[this.config.hashAttribute];
        if (typeof identifier !== "string" || identifier.trim().length === 0) {
            // Return the first variant as a safe default when context is missing
            const defaultVariant = this.config.variants[0];
            return {
                value: defaultVariant.value,
                variant: defaultVariant.key,
                reason: "MISSING_CONTEXT",
            };
        }

        const bucket = computeBucket(identifier, this.flagKey);

        // Walk the variant list accumulating weights until we find the bucket
        let accumulated = 0;
        for (const variant of this.config.variants) {
            accumulated += variant.weight;
            if (bucket < accumulated) {
                return {
                    value: variant.value,
                    variant: variant.key,
                    reason: "AB_VARIANT",
                };
            }
        }

        // Fallback to last variant (handles floating point edge cases)
        const last = this.config.variants[this.config.variants.length - 1];
        return { value: last.value, variant: last.key, reason: "AB_VARIANT" };
    }
}
