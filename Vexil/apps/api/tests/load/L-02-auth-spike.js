/**
 * L-02: Auth spike — 50 concurrent logins
 * Pass criteria: p99 < 500ms, no 5xx responses
 *
 * Run: k6 run tests/load/L-02-auth-spike.js
 * Requires: TEST_EMAIL, TEST_PASSWORD env vars (a valid user must exist)
 */
import http from "k6/http";
import { sleep, check } from "k6";
import { Trend, Counter } from "k6/metrics";

const loginLatency = new Trend("login_latency");
const serverErrors = new Counter("server_errors");

export const options = {
    vus: 50,
    duration: "30s",
    thresholds: {
        login_latency: ["p(99)<500"],
        server_errors: ["count==0"],
    },
};

const BASE_URL = __ENV.BASE_URL || "http://localhost:3000";
const EMAIL    = __ENV.TEST_EMAIL || "demo@vexil.dev";
const PASSWORD = __ENV.TEST_PASSWORD || "password123";

export default function () {
    const res = http.post(
        `${BASE_URL}/api/auth/login`,
        JSON.stringify({ email: EMAIL, password: PASSWORD }),
        { headers: { "Content-Type": "application/json" } }
    );

    loginLatency.add(res.timings.duration);

    const ok = check(res, {
        "status 200 or 429 (rate limited)": (r) => r.status === 200 || r.status === 429,
        "no 5xx": (r) => r.status < 500,
    });

    if (res.status >= 500) {
        serverErrors.add(1);
        console.error(`VU ${__VU}: 5xx on login — ${res.status}: ${res.body}`);
    }

    sleep(0.1); // Small pause between requests within the burst
}
