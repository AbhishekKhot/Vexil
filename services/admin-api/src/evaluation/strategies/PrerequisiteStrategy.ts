import {
    PrerequisiteConfig,
    EvaluationResult,
    IEvaluationStrategy,
    assertNonEmptyString,
} from "../EvaluationStrategy.interface";

/**
 * Prerequisite Strategy
 *
 * This strategy depends on a callback that evaluates the prerequisite flag.
 * The callback is injected (not imported directly) to avoid circular module
 * dependencies between EvaluationEngine and this strategy.
 *
 * The EvaluationEngine passes a depth counter when constructing this strategy
 * to enforce a recursion depth limit and prevent infinite loops.
 */
export type PrerequisiteEvaluator = (
    flagKey: string,
    context: Record<string, unknown>
) => Promise<EvaluationResult | null>;

export class PrerequisiteStrategy implements IEvaluationStrategy {
    readonly strategyType = "prerequisite" as const;

    constructor(
        private readonly config: PrerequisiteConfig,
        private readonly evaluator: PrerequisiteEvaluator
    ) {
        assertNonEmptyString(config.flagKey, "flagKey");
    }

    async evaluate(context: Record<string, unknown>): Promise<EvaluationResult> {
        try {
            const prereqResult = await this.evaluator(this.config.flagKey, context);

            if (!prereqResult) {
                // Prerequisite flag doesn't exist or couldn't be evaluated
                return { value: false, reason: "PREREQUISITE_UNMET" };
            }

            const met = JSON.stringify(prereqResult.value) === JSON.stringify(this.config.expectedValue);
            return {
                value: met,
                reason: met ? "PREREQUISITE_MET" : "PREREQUISITE_UNMET",
            };
        } catch {
            return { value: false, reason: "ERROR" };
        }
    }
}
