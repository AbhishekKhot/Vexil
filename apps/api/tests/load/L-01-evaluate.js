/**
 * L-01: Constant SDK polling — 10 VUs call /v1/flags/evaluate every 30s
 * Pass criteria: p95 < 200ms, 0 errors (non-429)
 *
 * Run: k6 run tests/load/L-01-evaluate.js
 * Requires: VEXIL_API_KEY env var (export VEXIL_API_KEY=vex_xxx)
 */
import http from "k6/http";
import { sleep, check } from "k6";
import { Trend, Counter } from "k6/metrics";

const evalLatency = new Trend("eval_latency");
const errorCount = new Counter("eval_errors");

export const options = {
  vus: 10,
  duration: "5m",
  thresholds: {
    eval_latency: ["p(95)<200"],
    eval_errors: ["count==0"],
    http_req_failed: ["rate<0.01"],
  },
};

const BASE_URL = __ENV.BASE_URL || "http://localhost:3000";
const API_KEY = __ENV.VEXIL_API_KEY;

if (!API_KEY) {
  throw new Error(
    "VEXIL_API_KEY env var is required. Export it before running: export VEXIL_API_KEY=vex_xxx",
  );
}

export default function () {
  const userId = `load-user-${__VU}-${__ITER}`;

  const res = http.post(
    `${BASE_URL}/v1/flags/evaluate`,
    JSON.stringify({ context: { userId } }),
    {
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${API_KEY}`,
      },
    },
  );

  evalLatency.add(res.timings.duration);

  const ok = check(res, {
    "status is 200": (r) => r.status === 200,
    "response has flags": (r) => {
      try {
        return typeof JSON.parse(r.body).flags === "object";
      } catch {
        return false;
      }
    },
  });

  if (!ok && res.status !== 429) {
    errorCount.add(1);
    console.error(`VU ${__VU} iter ${__ITER}: unexpected status ${res.status}`);
  }

  // Simulate SDK polling interval (30s). In k6 we sleep to pace requests.
  sleep(30);
}
