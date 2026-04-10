// Unit tests: UserTargetingStrategy (U-ST-09..13)
import { describe, it, expect } from "vitest";
import { UserTargetingStrategy } from "../../../src/evaluation/strategies/UserTargetingStrategy";
import { StrategyValidationError } from "../../../src/evaluation/EvaluationStrategy.interface";

describe("UserTargetingStrategy", () => {
    it("U-ST-09: userId in userIds list → true, reason USER_WHITELIST", () => {
        const s = new UserTargetingStrategy({
            strategyType: "user_targeting",
            userIds: ["alice", "bob"],
            hashAttribute: "userId",
            fallthrough: false,
        });
        const r = s.evaluate({ userId: "alice" });
        expect(r.value).toBe(true);
        expect(r.reason).toBe("USER_WHITELIST");
    });

    it("U-ST-10: userId NOT in list, fallthrough: false → false, reason USER_FALLTHROUGH", () => {
        const s = new UserTargetingStrategy({
            strategyType: "user_targeting",
            userIds: ["alice"],
            hashAttribute: "userId",
            fallthrough: false,
        });
        const r = s.evaluate({ userId: "charlie" });
        expect(r.value).toBe(false);
        expect(r.reason).toBe("USER_FALLTHROUGH");
    });

    it("U-ST-11: userId NOT in list, fallthrough: true → true, reason USER_FALLTHROUGH", () => {
        const s = new UserTargetingStrategy({
            strategyType: "user_targeting",
            userIds: ["alice"],
            hashAttribute: "userId",
            fallthrough: true,
        });
        const r = s.evaluate({ userId: "charlie" });
        expect(r.value).toBe(true);
        expect(r.reason).toBe("USER_FALLTHROUGH");
    });

    it("U-ST-12: empty userIds array → StrategyValidationError at construction", () => {
        expect(() =>
            new UserTargetingStrategy({
                strategyType: "user_targeting",
                userIds: [],
                hashAttribute: "userId",
                fallthrough: false,
            })
        ).toThrow(StrategyValidationError);
    });

    it("U-ST-13: missing hashAttribute → StrategyValidationError", () => {
        expect(() =>
            new UserTargetingStrategy({
                strategyType: "user_targeting",
                userIds: ["alice"],
                hashAttribute: "",
                fallthrough: false,
            })
        ).toThrow(StrategyValidationError);
    });

    it("U-ST-14: fallthrough not a boolean → StrategyValidationError at construction", () => {
        expect(() =>
            new UserTargetingStrategy({
                strategyType: "user_targeting",
                userIds: ["alice"],
                hashAttribute: "userId",
                fallthrough: "yes" as any,
            })
        ).toThrow(StrategyValidationError);
    });

    it("U-ST-15: context missing hashAttribute field → MISSING_CONTEXT reason, value = fallthrough", () => {
        const s = new UserTargetingStrategy({
            strategyType: "user_targeting",
            userIds: ["alice"],
            hashAttribute: "userId",
            fallthrough: true,
        });
        const r = s.evaluate({ country: "US" }); // no userId
        expect(r.reason).toBe("MISSING_CONTEXT");
        expect(r.value).toBe(true); // falls through to fallthrough value
    });

    it("U-ST-16: context has hashAttribute as empty string → MISSING_CONTEXT", () => {
        const s = new UserTargetingStrategy({
            strategyType: "user_targeting",
            userIds: ["alice"],
            hashAttribute: "userId",
            fallthrough: false,
        });
        const r = s.evaluate({ userId: "   " }); // whitespace-only string
        expect(r.reason).toBe("MISSING_CONTEXT");
    });
});
