// Unit tests: extractApiKey utility (EK-1..6)
import { describe, it, expect } from "vitest";
import { extractApiKey } from "../../src/utils/extractApiKey";

describe("extractApiKey()", () => {
    it("EK-1: valid 'Bearer vex_abc123' → returns 'vex_abc123'", () => {
        expect(extractApiKey("Bearer vex_abc123")).toBe("vex_abc123");
    });

    it("EK-2: undefined header → returns null", () => {
        expect(extractApiKey(undefined)).toBeNull();
    });

    it("EK-3: 'Bearer ' (empty key after Bearer) → returns null", () => {
        expect(extractApiKey("Bearer ")).toBeNull();
    });

    it("EK-4: 'Bearer   ' (whitespace-only key after Bearer) → returns null", () => {
        expect(extractApiKey("Bearer   ")).toBeNull();
    });

    it("EK-5: header without 'Bearer ' prefix (e.g. Basic token) → returns null", () => {
        expect(extractApiKey("Basic dXNlcjpwYXNz")).toBeNull();
    });

    it("EK-6: key with internal spaces is returned trimmed", () => {
        expect(extractApiKey("Bearer  vex_padded")).toBe("vex_padded");
    });
});
