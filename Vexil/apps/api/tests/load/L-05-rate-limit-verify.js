/**
 * L-05: Rate-limit verification — confirm 429s fire at correct thresholds under real Redis
 * Pass criteria: 429 fires at limit, NOT before it
 *
 * Run: k6 run tests/load/L-05-rate-limit-verify.js
 * Requires: VEXIL_API_KEY env var
 *
 * NOTE: This test uses a single VU to hit exact limits. Each run needs a fresh IP/key
 * (or a Redis flush) to avoid interference from prior runs.
 */
import http from "k6/http";
import { check, sleep } from "k6";
import { Counter } from "k6/metrics";

const prematureLimits = new Counter("premature_429s"); // 429 before limit — BAD
const missedLimits    = new Counter("missed_429s");    // no 429 at limit — BAD

export const options = {
    vus: 1,
    iterations: 1, // single pass, deterministic
    thresholds: {
        premature_429s: ["count==0"],
        missed_429s: ["count==0"],
    },
};

const BASE_URL = __ENV.BASE_URL   || "http://localhost:3000";
const API_KEY  = __ENV.VEXIL_API_KEY;

if (!API_KEY) throw new Error("VEXIL_API_KEY env var required.");

function hitN(url: string, n: number, headers: Record<string, string>, body: string | null = null): number[] {
    const results: number[] = [];
    for (let i = 0; i < n; i++) {
        const res = body
            ? http.post(url, body, { headers })
            : http.get(url, { headers });
        results.push(res.status);
    }
    return results;
}

export default function () {
    const evalHeaders = {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${API_KEY}`,
    };

    // ── Verify eval token bucket: EVAL_BUCKET_CAPACITY (default 5) ─────────────
    // First CAPACITY requests should pass, next should be 429
    const CAPACITY = parseInt(__ENV.EVAL_BUCKET_CAPACITY || "5");
    console.log(`Testing eval token bucket with capacity=${CAPACITY}`);

    const evalResults: number[] = [];
    for (let i = 0; i < CAPACITY + 2; i++) {
        const res = http.post(`${BASE_URL}/v1/flags/evaluate`, JSON.stringify({}), { headers: evalHeaders });
        evalResults.push(res.status);
        if (i === CAPACITY - 1) {
            // Last request at limit should succeed
            check(res, { [`request ${i + 1} (at limit) should be 200`]: (r) => r.status === 200 });
            if (res.status !== 200) prematureLimits.add(1);
        }
        if (i === CAPACITY) {
            // First request OVER limit should be 429
            check(res, { [`request ${i + 1} (over limit) should be 429`]: (r) => r.status === 429 });
            if (res.status !== 429) missedLimits.add(1);
        }
        // Don't sleep — we want to test burst behavior
    }

    console.log(`Eval results (first ${CAPACITY + 2} requests): ${evalResults.join(", ")}`);

    // ── Verify 429 response contains Retry-After header ──────────────────────
    const throttledRes = evalResults.includes(429)
        ? http.post(`${BASE_URL}/v1/flags/evaluate`, JSON.stringify({}), { headers: evalHeaders })
        : null;

    if (throttledRes && throttledRes.status === 429) {
        check(throttledRes, {
            "429 has Retry-After header": (r) => r.headers["Retry-After"] !== undefined || r.headers["retry-after"] !== undefined,
            "429 has error field": (r) => {
                try { return typeof JSON.parse(r.body).error === "string"; }
                catch { return false; }
            },
        });
    }

    sleep(1);
}
