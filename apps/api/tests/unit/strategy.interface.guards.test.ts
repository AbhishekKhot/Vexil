// Unit tests: EvaluationStrategy interface guard helpers (SI-1..11)
import { describe, it, expect } from "vitest";
import {
    assertPercentage,
    assertNonEmptyString,
    assertNonEmptyArray,
    StrategyValidationError,
} from "../../src/evaluation/EvaluationStrategy.interface";

describe("assertPercentage()", () => {
    it("SI-1: valid percentage 50 → does not throw", () => {
        expect(() => assertPercentage(50, "percentage")).not.toThrow();
    });

    it("SI-2: valid boundary 0 → does not throw", () => {
        expect(() => assertPercentage(0, "percentage")).not.toThrow();
    });

    it("SI-3: valid boundary 100 → does not throw", () => {
        expect(() => assertPercentage(100, "percentage")).not.toThrow();
    });

    it("SI-4: -1 (below 0) → throws StrategyValidationError", () => {
        expect(() => assertPercentage(-1, "percentage"))
            .toThrow(StrategyValidationError);
    });

    it("SI-5: 101 (above 100) → throws StrategyValidationError", () => {
        expect(() => assertPercentage(101, "percentage"))
            .toThrow(StrategyValidationError);
    });

    it("SI-6: string '50' (non-number) → throws StrategyValidationError", () => {
        expect(() => assertPercentage("50", "percentage"))
            .toThrow(StrategyValidationError);
    });
});

describe("assertNonEmptyString()", () => {
    it("SI-7: valid string 'hello' → does not throw", () => {
        expect(() => assertNonEmptyString("hello", "flagKey")).not.toThrow();
    });

    it("SI-8: empty string '' → throws StrategyValidationError", () => {
        expect(() => assertNonEmptyString("", "flagKey"))
            .toThrow(StrategyValidationError);
    });

    it("SI-9: whitespace-only string '   ' → throws StrategyValidationError", () => {
        expect(() => assertNonEmptyString("   ", "flagKey"))
            .toThrow(StrategyValidationError);
    });

    it("SI-10: number 42 (non-string) → throws StrategyValidationError", () => {
        expect(() => assertNonEmptyString(42, "flagKey"))
            .toThrow(StrategyValidationError);
    });
});

describe("assertNonEmptyArray()", () => {
    it("SI-11: valid array [1, 2] → does not throw", () => {
        expect(() => assertNonEmptyArray([1, 2], "variants")).not.toThrow();
    });

    it("SI-12: empty array [] → throws StrategyValidationError", () => {
        expect(() => assertNonEmptyArray([], "variants"))
            .toThrow(StrategyValidationError);
    });

    it("SI-13: non-array string 'x' → throws StrategyValidationError", () => {
        expect(() => assertNonEmptyArray("x", "variants"))
            .toThrow(StrategyValidationError);
    });

    it("SI-14: null → throws StrategyValidationError", () => {
        expect(() => assertNonEmptyArray(null, "variants"))
            .toThrow(StrategyValidationError);
    });
});
