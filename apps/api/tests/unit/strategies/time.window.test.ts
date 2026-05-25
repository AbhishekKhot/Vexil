import { describe, it, expect, vi, afterEach } from "vitest";
import { TimeWindowStrategy } from "../../../src/evaluation/strategies/TimeWindowStrategy";
import { StrategyValidationError } from "../../../src/evaluation/EvaluationStrategy.interface";

afterEach(() => {
    vi.useRealTimers();
});

describe("TimeWindowStrategy", () => {
    it("U-ST-29: current time within window → true, reason TIME_WINDOW_ACTIVE", () => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date("2025-06-15T12:00:00Z"));

        const s = new TimeWindowStrategy({
            strategyType: "time_window",
            startDate: "2025-06-01T00:00:00Z",
            endDate: "2025-07-01T00:00:00Z",
        });
        const r = s.evaluate({});
        expect(r.value).toBe(true);
        expect(r.reason).toBe("TIME_WINDOW_ACTIVE");
    });

    it("U-ST-30: current time before window → false, reason TIME_WINDOW_INACTIVE", () => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date("2025-05-01T00:00:00Z"));

        const s = new TimeWindowStrategy({
            strategyType: "time_window",
            startDate: "2025-06-01T00:00:00Z",
            endDate: "2025-07-01T00:00:00Z",
        });
        const r = s.evaluate({});
        expect(r.value).toBe(false);
        expect(r.reason).toBe("TIME_WINDOW_INACTIVE");
    });

    it("U-ST-31: current time after window → false, reason TIME_WINDOW_INACTIVE", () => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date("2025-08-01T00:00:00Z"));

        const s = new TimeWindowStrategy({
            strategyType: "time_window",
            startDate: "2025-06-01T00:00:00Z",
            endDate: "2025-07-01T00:00:00Z",
        });
        const r = s.evaluate({});
        expect(r.value).toBe(false);
        expect(r.reason).toBe("TIME_WINDOW_INACTIVE");
    });

    it("U-ST-32: invalid timezone string → falls back to server time without throwing", () => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date("2025-06-15T12:00:00Z"));

        const s = new TimeWindowStrategy({
            strategyType: "time_window",
            startDate: "2025-06-01T00:00:00Z",
            endDate: "2025-07-01T00:00:00Z",
            timezone: "Not/A_Valid_Timezone",
        });

        const r = s.evaluate({});

        expect(r.value).toBe(true);
    });

    it("U-ST-33: startDate === endDate → throws StrategyValidationError", () => {
        expect(() => new TimeWindowStrategy({
            strategyType: "time_window",
            startDate: "2025-06-01T00:00:00Z",
            endDate: "2025-06-01T00:00:00Z",
        })).toThrow(StrategyValidationError);
    });

    it("U-ST-34: startDate after endDate → throws StrategyValidationError", () => {
        expect(() => new TimeWindowStrategy({
            strategyType: "time_window",
            startDate: "2025-07-01T00:00:00Z",
            endDate: "2025-06-01T00:00:00Z",
        })).toThrow(StrategyValidationError);
    });

    it("U-ST-35: invalid startDate format → throws StrategyValidationError", () => {
        expect(() => new TimeWindowStrategy({
            strategyType: "time_window",
            startDate: "not-a-date",
            endDate: "2025-07-01T00:00:00Z",
        })).toThrow(StrategyValidationError);
    });
});
