# CLAUDE.md — Vexil Feature Flag Service

## Project Overview

Vexil is a self-hosted feature flag service built with:- **Backend**: Node.js + Fastify + TypeORM + PostgreSQL + Redis + RabbitMQ- **Frontend**: React 19 + Vite + Tailwind CSS + React Router 7- **SDKs**: JavaScript/TypeScript (axios), Ruby (stdlib Net::HTTP)
**Monorepo layout:**`/docker-compose.yml   — Postgres, Redis, RabbitMQ (run: docker compose up -d)/packages/types/      — Shared TS types (@vexil/types)/services/admin-api   — Fastify backend (port 3000)/services/admin-ui    — React frontend (port 5173, dev)/services/sdk-js      — JS/TS SDK (npm package @vexil/sdk-js)/services/sdk-ruby    — Ruby SDK (single file lib/vexil.rb)/docs/                — API reference`
**Key ports:** Backend: 3000, Frontend: 5173, Postgres: 5433, Redis: 6379, RabbitMQ: 5672

---

## Feature Status

### ✅ 100% Working

| Feature | Files ||---|---|| Auth (register/login/JWT/me) | `AuthController`, `AuthService`, `authMiddleware`, `LoginPage`, `RegisterPage` || Project CRUD (create/list/delete) | `ProjectController`, `ProjectService`, `ProjectsDashboard` || Environment CRUD + API key generation + rotation | `EnvironmentController`, `EnvironmentService`, `EnvironmentsTab` || Flag CRUD (create/list/edit/delete) + search/filter | `FlagController`, `FlagService`, `FlagsTab` || Flag config set/get per environment | `FlagConfigController`, `FlagConfigService`, `FlagConfigurePage` || Evaluation Engine (all 8 strategies) | `EvaluationEngine`, `StrategyFactory`, all `strategies/*.ts` || Redis caching (env + configs, TTL) | `EvaluationService`, `FlagConfigService`, `redis.ts` || Scheduled flag changes | `SchedulerService` (60s poll) || Audit log (record + view) | `AuditLogService`, `AuditLogTab` || Analytics ingestion (POST /v1/events) | `AnalyticsController`, `AnalyticsService` || Analytics dashboard (per-project, env filter, flag filter, disabled count) | `AnalyticsTab`, `GET /api/projects/:id/stats` || RabbitMQ publish + consumer worker | `rabbitmq.ts`, `EventConsumer.ts`, `AnalyticsService.ingestEvents` || Segment CRUD (create/list/edit/delete) + visual rule builder | `SegmentController`, `SegmentService`, `SegmentsTab` || RBAC enforced on all write routes | `rbacMiddleware.ts`, all route files || UI → API connectivity | `apiClient` baseURL fixed to `/api`, auth prefixes corrected || Vite proxy for `/v1` (dev) | `vite.config.ts` || Docker Compose (postgres, redis, rabbitmq) | `docker-compose.yml` || Shared TypeScript types package | `packages/types/` (`@vexil/types`) || JS SDK (fetchFlags, isEnabled, getValue, analytics buffer, auto-polling) | `sdk-js/src/index.ts` || Ruby SDK core (fetch_flags, enabled?, value, details) | `sdk-ruby/lib/vexil.rb` |

### ❌ Not Implemented

## | Feature | Notes ||---|---|| **Settings page** | Placeholder "Coming Soon" || **User management UI** | No team invite, role assignment, or member listing || **OpenAPI / Swagger docs** | ✅ Implemented — Swagger UI at `/docs` || **Frontend tests** | No test files in admin-ui |

## Implementation Plan

### ✅ PHASE 1 — Critical Bug Fixes — COMPLETE- Fixed `apiClient` baseURL `'/'` → `'/api'`- Removed `/api` prefix from auth page calls (AuthContext, LoginPage, RegisterPage)- Added `/v1` proxy in `vite.config.ts`- Moved analytics stats to `GET /api/projects/:id/stats` (JWT-protected)- Fixed `AnalyticsService.getAnalytics` to join `Environment` and filter by `projectId`- Fixed segment delete URL in `SegmentsTab`

### ✅ PHASE 2 — Missing Backend Routes — COMPLETE- Added `PUT /:projectId/flags/:flagId` (update description/type + audit log)- Added `PUT /:projectId/segments/:segmentId` (update name/description/rules + audit log)- Added `POST /:projectId/environments/:envId/rotate-key` (regenerate API key, invalidate Redis cache)- Split analytics routes: data plane (`POST /v1/events`), control plane (`GET /api/projects/:id/stats`)

### ✅ PHASE 3 — UI Completion — COMPLETE- Flag edit modal (pencil icon, type + description editing) + search/type-filter in FlagsTab- Segment edit modal + visual rule builder replacing raw JSON textarea in SegmentsTab- "Rotate Key" button with confirm dialog in EnvironmentsTab- Analytics dashboard: env filter dropdown, flag key search, disabled count, correct URL

### ✅ PHASE 4 — JS SDK Completion — COMPLETE- Analytics event buffer (30s flush interval, 1000-event limit) via `captureEvaluation()` / `flush()`- Auto-capture evaluations on `fetchFlags()` — no manual tracking needed- `pollingInterval` option for background flag refresh; `stopPolling()` / `destroy()` for cleanup- `engines: ">=18"` and `exports` field in `package.json`

### ✅ PHASE 5 — Infrastructure — COMPLETE- `docker-compose.yml` with postgres, redis, rabbitmq (health checks + volumes)- `EventConsumer.ts` worker with exponential backoff; started from `server.ts` if `RABBITMQ_URL` set- RBAC enforced: ADMIN+MEMBER on POST/PUT, ADMIN-only on DELETE project/environment

### ✅ PHASE 6 — Developer Experience — COMPLETE- `packages/types/` (`@vexil/types`) with all shared TS types; added to root workspaces- `docs/api-overview.md` with full route reference- OpenAPI / Swagger UI at `GET /docs` — all 9 route groups documented with full request/response schemas (`@fastify/swagger` + `@fastify/swagger-ui`)- `README.md` updated with "Getting Started" guide, full env var table, and accurate SDK quick-start examples- `services/sdk-js/README.md` rewritten to match actual SDK API (`VexilClient`, `fetchFlags`, `isEnabled`, `getValue`, `getDetails`, `pollingInterval`, `flush`, `destroy`)

### ❌ Remaining (low priority)- Settings page (currently "Coming Soon" placeholder)- User management UI (team invite, role assignment)- Frontend tests

---

## Bug Index (Quick Reference)

All bugs resolved. ✅
| ID | File | Bug | Status ||---|---|---|---|| BUG-01 | `admin-ui/src/api/client.ts` | `baseURL: '/'` caused all non-auth API calls to fail | **Fixed** — changed to `'/api'` || BUG-02 | Auth pages | `/api/auth/...` double-prefixed after BUG-01 fix | **Fixed** — removed `/api` prefix from auth calls || BUG-03 | `vite.config.ts` | `/v1` routes not proxied to backend | **Fixed** — added `/v1` proxy entry || BUG-04 | `AnalyticsTab.tsx` | Calls wrong URL for stats | **Fixed** — stats moved to `GET /api/projects/:id/stats` || BUG-05 | `AnalyticsService.ts` | `projectId` param ignored in SQL query | **Fixed** — added `innerJoin(Environment)` filter || BUG-06 | `SegmentsTab.tsx` | Delete called `/segments/${id}` — wrong URL | **Fixed** — corrected to `/projects/${projectId}/segments/${id}` || BUG-07 | `flagRoutes.ts` | No `PUT` route for flag edit | **Fixed** — added PUT + controller + service method || BUG-08 | `segmentRoutes.ts` | No `PUT` route for segment edit | **Fixed** — added PUT + controller + service method |

---

## Architecture Notes

### Evaluation Flow (Backend)`POST /v1/eval (API key)  → EvaluationService.evaluateFlags()    → Redis cache check (env_apikey:{key}, 5min TTL)    → Redis cache check (env_configs:{envId}, 30s TTL)    → EvaluationEngine.evaluate(configs, context)      → StrategyFactory.create(config) → Strategy instance      → strategy.evaluate(context) → EvaluationResult    → logEvents() fire-and-forget  → return { flags: { [key]: { value, type, variant, reason } } }`

### Strategy Types (all implemented in backend)1. `boolean` — kill switch, returns `isEnabled`2. `rollout` — djb2 hash % 100 < percentage3. `targeted_rollout` — rules match AND rollout4. `user_targeting` — user ID in whitelist5. `attribute_matching` — ALL rules pass (AND logic)6. `ab_test` — weighted variants via hash bucket7. `time_window` — UTC time between start/end8. `prerequisite` — another flag's value matches expected

### SDK Usage Pattern`typescriptconst client = new VexilClient({ apiKey: 'vex_...', baseUrl: 'http://localhost:3000' });await client.fetchFlags({ userId: 'user_123', country: 'US', tier: 'premium' });if (client.isEnabled('new-dashboard')) { /* ... */ }const theme = client.getValue<string>('ui-theme');`

### Hashing (for rollout/ab_test determinism)- Algorithm: djb2 (not MurmurHash3 as README claims — README is aspirational)- `computeBucket(identifier + ':' + seed)` → 0-99- Salt = flag key (ensures independent rollouts per flag)- `hashAttribute` defaults to `userId` from context

---

## Development Commands

````bash# Backendcd services/admin-apinpm installcp .env.example .env   # configure DB/Redis/RabbitMQnpm run dev            # ts-node, port 3000
# Frontendcd services/admin-uinpm installnpm run dev            # Vite, port 5173
# JS SDKcd services/sdk-jsnpm installnpm run build          # tsup → dist/
# Tests (backend only)cd services/admin-apinpm test               # Jest + SQLite in-memory```
## Environment Variables (admin-api)
| Variable | Default | Description ||---|---|---|| `PORT` | 3000 | Fastify listen port || `DB_HOST` | 127.0.0.1 | PostgreSQL host || `DB_PORT` | 5433 | PostgreSQL port || `DB_USER` | postgres | PostgreSQL user || `DB_PASS` | postgres | PostgreSQL password || `DB_NAME` | vexil | PostgreSQL database name || `REDIS_HOST` | 127.0.0.1 | Redis host || `REDIS_PORT` | 6379 | Redis port || `RABBITMQ_URL` | amqp://guest:guest@127.0.0.1:5672 | RabbitMQ connection URL || `JWT_SECRET` | vexil-dev-secret-change-in-prod | JWT signing secret || `NODE_ENV` | development | Environment (test uses ioredis-mock) |
````
