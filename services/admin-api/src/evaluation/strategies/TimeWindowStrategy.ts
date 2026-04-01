import {
    TimeWindowConfig,
    EvaluationResult,
    IEvaluationStrategy,
    assertNonEmptyString,
    StrategyValidationError,
} from "../EvaluationStrategy.interface";

export class TimeWindowStrategy implements IEvaluationStrategy {
    readonly strategyType = "time_window" as const;

    private readonly start: Date;
    private readonly end: Date;

    constructor(private readonly config: TimeWindowConfig) {
        assertNonEmptyString(config.startDate, "startDate");
        assertNonEmptyString(config.endDate, "endDate");

        this.start = new Date(config.startDate);
        this.end   = new Date(config.endDate);

        if (isNaN(this.start.getTime())) {
            throw new StrategyValidationError("startDate is not a valid ISO 8601 date string");
        }
        if (isNaN(this.end.getTime())) {
            throw new StrategyValidationError("endDate is not a valid ISO 8601 date string");
        }
        if (this.start >= this.end) {
            throw new StrategyValidationError("startDate must be before endDate");
        }
    }

    evaluate(_context: Record<string, unknown>): EvaluationResult {
        const now = new Date();
        const active = now >= this.start && now <= this.end;
        return {
            value: active,
            reason: active ? "TIME_WINDOW_ACTIVE" : "TIME_WINDOW_INACTIVE",
        };
    }
}
