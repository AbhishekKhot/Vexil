import {
    BooleanConfig,
    EvaluationResult,
    IEvaluationStrategy,
} from "../EvaluationStrategy.interface";

export class BooleanStrategy implements IEvaluationStrategy {
    readonly strategyType = "boolean" as const;

    constructor(private readonly config: BooleanConfig, private readonly isEnabled: boolean) {}

    evaluate(_context: Record<string, unknown>): EvaluationResult {
        return {
            value: this.isEnabled,
            reason: this.isEnabled ? "ENABLED" : "DISABLED",
        };
    }
}
