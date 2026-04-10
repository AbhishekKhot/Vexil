/**
 * L-03: Dashboard simulation — CRUD flags + configs
 * Pass criteria: p95 < 300ms
 *
 * Run: k6 run tests/load/L-03-control-plane.js
 * Requires: VEXIL_JWT, PROJECT_ID env vars
 */
import http from "k6/http";
import { sleep, check } from "k6";
import { Trend, Counter } from "k6/metrics";

const crudLatency = new Trend("crud_latency");
const errorCount  = new Counter("crud_errors");

export const options = {
    vus: 5,
    duration: "3m",
    thresholds: {
        crud_latency: ["p(95)<300"],
        crud_errors: ["count==0"],
    },
};

const BASE_URL  = __ENV.BASE_URL   || "http://localhost:3000";
const JWT       = __ENV.VEXIL_JWT;
const PROJECT_ID = __ENV.PROJECT_ID;

if (!JWT) throw new Error("VEXIL_JWT env var required. Get it from POST /api/auth/login.");
if (!PROJECT_ID) throw new Error("PROJECT_ID env var required.");

const HEADERS = {
    "Content-Type": "application/json",
    "Authorization": `Bearer ${JWT}`,
};

export default function () {
    const flagKey = `load-flag-${__VU}-${__ITER}-${Date.now()}`;

    // 1. Create flag
    const createRes = http.post(
        `${BASE_URL}/api/projects/${PROJECT_ID}/flags`,
        JSON.stringify({ key: flagKey, type: "release", description: "Load test flag" }),
        { headers: HEADERS }
    );
    crudLatency.add(createRes.timings.duration);
    if (!check(createRes, { "create flag 201": (r) => r.status === 201 })) {
        errorCount.add(1);
        return;
    }

    const flagId = JSON.parse(createRes.body)?.id;
    if (!flagId) { errorCount.add(1); return; }

    // 2. List flags
    const listRes = http.get(`${BASE_URL}/api/projects/${PROJECT_ID}/flags`, { headers: HEADERS });
    crudLatency.add(listRes.timings.duration);
    check(listRes, { "list flags 200": (r) => r.status === 200 });

    sleep(0.5);

    // 3. Delete flag (cleanup)
    const deleteRes = http.del(`${BASE_URL}/api/projects/${PROJECT_ID}/flags/${flagId}`, null, { headers: HEADERS });
    crudLatency.add(deleteRes.timings.duration);
    check(deleteRes, { "delete flag 204": (r) => r.status === 204 });

    sleep(1);
}
