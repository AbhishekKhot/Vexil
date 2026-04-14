/**
 * L-04: SDK event flush — batches of 500 events, 5 VUs
 * Pass criteria: 0 unhandled errors, no 5xx
 *
 * Run: k6 run tests/load/L-04-event-flood.js
 * Requires: VEXIL_API_KEY env var
 */
import http from "k6/http";
import { sleep, check } from "k6";
import { Counter, Trend } from "k6/metrics";

const flushLatency = new Trend("flush_latency");
const serverErrors = new Counter("event_server_errors");

export const options = {
  vus: 5,
  duration: "2m",
  thresholds: {
    event_server_errors: ["count==0"],
    flush_latency: ["p(95)<500"],
  },
};

const BASE_URL = __ENV.BASE_URL || "http://localhost:3000";
const API_KEY = __ENV.VEXIL_API_KEY;

if (!API_KEY) throw new Error("VEXIL_API_KEY env var required.");

const FLAG_KEYS = [
  "boolean-test-flag",
  "rollout-test-flag",
  "user-targeting-test-flag",
  "ab-test-flag",
];

function buildBatch(size = 500) {
  const events = [];
  for (let i = 0; i < size; i++) {
    events.push({
      flagKey: FLAG_KEYS[i % FLAG_KEYS.length],
      result: Math.random() > 0.5,
      context: { userId: `user-${i}`, plan: i % 3 === 0 ? "pro" : "free" },
      timestamp: new Date().toISOString(),
    });
  }
  return events;
}

export default function () {
  const batch = buildBatch(500);

  const res = http.post(`${BASE_URL}/v1/events`, JSON.stringify(batch), {
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${API_KEY}`,
    },
  });

  flushLatency.add(res.timings.duration);

  const ok = check(res, {
    "status 202 or 429": (r) => r.status === 202 || r.status === 429,
    "no 5xx": (r) => r.status < 500,
  });

  if (res.status >= 500) {
    serverErrors.add(1);
    console.error(
      `VU ${__VU} iter ${__ITER}: 5xx on event flush — ${res.body}`,
    );
  }

  // Simulate SDK flush interval
  sleep(5);
}
