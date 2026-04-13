// Unit tests: hash.util (U-H-01..06)
import { describe, it, expect } from "vitest";
import { computeBucket, isInRollout } from "../../src/evaluation/hash.util";

describe("hash.util — computeBucket", () => {
    it("U-H-01: djb2 is deterministic — same input always returns same bucket", () => {
        const a = computeBucket("hello", "flag-x");
        const b = computeBucket("hello", "flag-x");
        expect(a).toBe(b);
    });

    it("U-H-02: different strings produce different hashes (basic collision check)", () => {
        const a = computeBucket("alice", "flag-x");
        const b = computeBucket("bob", "flag-x");
        expect(a).not.toBe(b);
    });

    it("U-H-03: same identifier with different seeds produces different buckets", () => {
        const a = computeBucket("alice", "flag-a");
        const b = computeBucket("alice", "flag-b");
        expect(a).not.toBe(b);
    });

    it("U-H-04: computeBucket returns value in [0, 99]", () => {
        const identifiers = ["alice", "bob", "charlie", "dave", "eve", "frank", "grace"];
        for (const id of identifiers) {
            const bucket = computeBucket(id, "test-flag");
            expect(bucket).toBeGreaterThanOrEqual(0);
            expect(bucket).toBeLessThanOrEqual(99);
        }
    });
});

describe("hash.util — isInRollout", () => {
    it("U-H-05: isInRollout(0, ...) → always false (short-circuit)", () => {
        const identifiers = ["alice", "bob", "charlie", "dave", "zara", "testuser", "omega"];
        for (const id of identifiers) {
            expect(isInRollout(id, "flag-k", 0)).toBe(false);
        }
    });

    it("U-H-06: isInRollout(100, ...) → always true (short-circuit)", () => {
        const identifiers = ["alice", "bob", "charlie", "dave", "zara", "testuser", "omega"];
        for (const id of identifiers) {
            expect(isInRollout(id, "flag-k", 100)).toBe(true);
        }
    });
});
