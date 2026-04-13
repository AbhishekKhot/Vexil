/**
 * Parses an environment API key from an Authorization header.
 *
 * Data-plane endpoints (evaluation, analytics ingest) are authenticated with
 * environment-scoped API keys sent as Bearer tokens, not JWT.  This utility
 * centralises that extraction so neither controller duplicates the same three
 * lines of parsing logic.
 *
 * Returns null when the header is absent or not in `Bearer <key>` form, so
 * callers can respond with 401 before touching any service.
 */
export function extractApiKey(authHeader: string | undefined): string | null {
    if (!authHeader?.startsWith("Bearer ")) return null;
    const key = authHeader.slice(7).trim();
    return key.length > 0 ? key : null;
}
