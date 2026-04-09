// djb2 hash — fast, non-cryptographic, good distribution for bucketing.
// hash & hash truncates to 32-bit integer on each iteration to avoid float overflow.
function djb2(str: string): number {
    let hash = 5381;
    for (let i = 0; i < str.length; i++) {
        hash = ((hash << 5) + hash) + str.charCodeAt(i);
        hash = hash & hash;
    }
    return hash;
}

/**
 * Maps an identifier to a deterministic bucket in [0, 99].
 * Seeding with flagKey ensures different flags produce independent bucket assignments
 * for the same user — avoids all flags toggling on/off at the same percentage threshold.
 */
export function computeBucket(identifier: string, seed: string): number {
    return Math.abs(djb2(`${identifier}::${seed}`)) % 100;
}

/**
 * Returns true if the identifier falls within the rollout percentage.
 * Short-circuits at 0% and 100% to avoid unnecessary hashing.
 */
export function isInRollout(identifier: string, seed: string, percentage: number): boolean {
    if (percentage <= 0) return false;
    if (percentage >= 100) return true;
    return computeBucket(identifier, seed) < percentage;
}
