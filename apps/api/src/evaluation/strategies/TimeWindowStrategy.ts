import { TimeWindowConfig, EvaluationResult, IEvaluationStrategy, assertNonEmptyString, StrategyValidationError } from "../EvaluationStrategy.interface";

/**
 * Time window strategy — enables the flag only between startDate and endDate.
 * Dates are parsed once at construction so each evaluate() call is just a comparison.
 * If a timezone is provided, server time is shifted into that timezone before comparing.
 */
export class TimeWindowStrategy implements IEvaluationStrategy {
    readonly strategyType = "time_window" as const;
    private readonly start: Date;
    private readonly end: Date;
    constructor(private readonly config: TimeWindowConfig) {
        assertNonEmptyString(config.startDate, "startDate");
        assertNonEmptyString(config.endDate, "endDate");
        this.start = new Date(config.startDate);
        this.end = new Date(config.endDate);
        if (isNaN(this.start.getTime())) throw new StrategyValidationError("startDate is not a valid ISO 8601 date");
        if (isNaN(this.end.getTime())) throw new StrategyValidationError("endDate is not a valid ISO 8601 date");
        if (this.start >= this.end) throw new StrategyValidationError("startDate must be before endDate");
    }
    evaluate(_context: Record<string, unknown>): EvaluationResult {
        let now = new Date();
        // toLocaleString with a timezone shifts the display string, then re-parsing it
        // gives a Date in that timezone's local time — a lightweight alternative to moment-timezone.
        if (this.config.timezone) {
            try {
                now = new Date(now.toLocaleString("en-US", { timeZone: this.config.timezone, hour12: false }));
            } catch { /* unsupported timezone — fall back to server time */ }
        }
        const active = now >= this.start && now <= this.end;
        return { value: active, reason: active ? "TIME_WINDOW_ACTIVE" : "TIME_WINDOW_INACTIVE" };
    }
}
