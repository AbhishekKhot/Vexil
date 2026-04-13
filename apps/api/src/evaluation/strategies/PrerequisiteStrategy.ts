import { PrerequisiteConfig, EvaluationResult, IEvaluationStrategy, assertNonEmptyString } from "../EvaluationStrategy.interface";

/**
 * A function that evaluates another flag by key — injected by EvaluationEngine
 * to avoid a circular dependency between PrerequisiteStrategy and EvaluationEngine.
 */
export type PrerequisiteEvaluator = (flagKey: string, context: Record<string, unknown>) => Promise<EvaluationResult | null>;

/**
 * Prerequisite strategy — this flag's result depends on another flag's value.
 * The evaluator is called recursively with depth tracking in EvaluationEngine
 * to prevent infinite loops (max depth: 3).
 * JSON.stringify comparison handles non-primitive expectedValues (e.g. objects).
 */
export class PrerequisiteStrategy implements IEvaluationStrategy {
    readonly strategyType = "prerequisite" as const;
    constructor(private readonly config: PrerequisiteConfig, private readonly evaluator: PrerequisiteEvaluator) {
        assertNonEmptyString(config.flagKey, "flagKey");
    }
    async evaluate(context: Record<string, unknown>): Promise<EvaluationResult> {
        try {
            const prereqResult = await this.evaluator(this.config.flagKey, context);
            if (!prereqResult) return { value: false, reason: "PREREQUISITE_UNMET" };
            const met = JSON.stringify(prereqResult.value) === JSON.stringify(this.config.expectedValue);
            return { value: met, reason: met ? "PREREQUISITE_MET" : "PREREQUISITE_UNMET" };
        } catch {
            return { value: false, reason: "ERROR" };
        }
    }
}
