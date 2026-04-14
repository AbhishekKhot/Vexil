import { BooleanConfig, EvaluationResult, IEvaluationStrategy } from "../EvaluationStrategy.interface";

/**
 * Kill-switch strategy — returns the flag's isEnabled state directly.
 * Context is intentionally ignored; this strategy is purely about the on/off toggle.
 */
export class BooleanStrategy implements IEvaluationStrategy {
    readonly strategyType = "boolean" as const;
    constructor(private readonly config: BooleanConfig, private readonly isEnabled: boolean) { }
    evaluate(_context: Record<string, unknown>): EvaluationResult {
        return { value: this.isEnabled, reason: this.isEnabled ? "ENABLED" : "DISABLED" };
    }
}
