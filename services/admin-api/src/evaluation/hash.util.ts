/**
 * Deterministic hash utilities for percentage-based flag evaluation.
 *
 * Uses the djb2 algorithm — fast, well-distributed, dependency-free,
 * and produces consistent results across restarts and languages.
 *
 * Design goals:
 *   - Same (identifier + seed) → always same bucket (0–99)
 *   - Even distribution across all 100 buckets
 *   - No external dependencies
 */

/**
 * djb2 hash — maps an arbitrary string to a 32-bit integer.
 * @see http://www.cse.yorku.ca/~oz/hash.html
 */
function djb2(str: string): number {
    let hash = 5381;
    for (let i = 0; i < str.length; i++) {
        // hash * 33 + char — bitwise to keep 32-bit
        hash = ((hash << 5) + hash) + str.charCodeAt(i);
        hash = hash & hash; // force 32-bit signed integer
    }
    return hash;
}

/**
 * Computes a deterministic bucket number (0–99) for a given identifier.
 *
 * The `seed` (typically the flag key) ensures different flags produce
 * independent bucket assignments for the same user — critical for avoiding
 * correlated rollouts where user 1 always gets ALL new features.
 *
 * @param identifier - The attribute to hash (e.g., userId, sessionId)
 * @param seed       - Entropy seed, typically the flag key
 * @returns Integer in [0, 99]
 */
export function computeBucket(identifier: string, seed: string): number {
    const combined = `${identifier}::${seed}`;
    return Math.abs(djb2(combined)) % 100;
}

/**
 * Returns true if the identifier falls within the rollout percentage.
 * Uses computeBucket internally.
 *
 * @param identifier  - Attribute value (e.g., "user_123")
 * @param seed        - Flag key for independent distribution
 * @param percentage  - Number in [0, 100]
 */
export function isInRollout(identifier: string, seed: string, percentage: number): boolean {
    if (percentage <= 0) return false;
    if (percentage >= 100) return true;
    return computeBucket(identifier, seed) < percentage;
}
