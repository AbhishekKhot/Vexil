import http from "k6/http";
import { check, sleep } from "k6";
import { Counter } from "k6/metrics";

const prematureLimits = new Counter("premature_429s");
const missedLimits    = new Counter("missed_429s");

export const options = {
    vus: 1,
    iterations: 1,
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

    const CAPACITY = parseInt(__ENV.EVAL_BUCKET_CAPACITY || "5");
    console.log(`Testing eval token bucket with capacity=${CAPACITY}`);

    const evalResults: number[] = [];
    for (let i = 0; i < CAPACITY + 2; i++) {
        const res = http.post(`${BASE_URL}/v1/flags/evaluate`, JSON.stringify({}), { headers: evalHeaders });
        evalResults.push(res.status);
        if (i === CAPACITY - 1) {

            check(res, { [`request ${i + 1} (at limit) should be 200`]: (r) => r.status === 200 });
            if (res.status !== 200) prematureLimits.add(1);
        }
        if (i === CAPACITY) {

            check(res, { [`request ${i + 1} (over limit) should be 429`]: (r) => r.status === 429 });
            if (res.status !== 429) missedLimits.add(1);
        }

    }

    console.log(`Eval results (first ${CAPACITY + 2} requests): ${evalResults.join(", ")}`);

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
