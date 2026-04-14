# @vexil/api

Fastify backend powering the Vexil feature flag platform. Exposes two planes:

- **Control plane** (`/api/*`) — JWT-protected, used by the dashboard for CRUD operations
- **Data plane** (`/v1/*`) — API-key-protected, used by SDK clients for evaluation and analytics

---

## Prerequisites

- Node.js >= 18
- npm >= 9
- PostgreSQL 16 and Redis 7 (provided by `docker-compose.yml` at repo root)

---

## Setup

### 1. Start infrastructure

From the **monorepo root**:

```bash
docker compose up -d
# PostgreSQL on :5432, Redis on :6379
```

### 2. Install dependencies

```bash
# From monorepo root (installs all workspaces)
npm install

# Or from this directory
cd apps/api && npm install
```

### 3. Configure environment

```bash
cp .env.example .env
```

| Variable | Default | Required | Description |
|----------|---------|----------|-------------|
| `PORT` | `3000` | | Fastify listen port |
| `NODE_ENV` | `development` | | Set `production` for JSON logs and stricter behaviour |
| `DB_HOST` | `127.0.0.1` | | PostgreSQL host |
| `DB_PORT` | `5432` | | PostgreSQL port |
| `DB_USER` | `postgres` | | PostgreSQL username |
| `DB_PASS` | `postgres` | | PostgreSQL password |
| `DB_NAME` | `vexil` | | Database name |
| `REDIS_HOST` | `127.0.0.1` | | Redis host |
| `REDIS_PORT` | `6379` | | Redis port |
| `JWT_SECRET` | — | **Yes** | Min 32-char secret. Server refuses to start without it. Generate: `openssl rand -hex 32` |
| `WEB_URL` | `http://localhost:5173` | | CORS allowed origin (dashboard URL) |
| `MAX_EVAL_PER_DAY` | `100` | | Max SDK evaluate calls per API key per day |
| `EVAL_BUCKET_CAPACITY` | `5` | | Token-bucket burst size per API key |
| `EVAL_REFILL_RATE_MS` | `2000` | | One token added every N ms (2000 = 0.5 req/s) |

> In `NODE_ENV=test` the API uses an in-memory Redis mock — no real Redis required for tests.

### 4. Run

```bash
# Dev (ts-node, hot-ish restart)
npm run dev

# Production build
npm run build
npm start
```

The API starts on `http://localhost:3000`.  
Swagger UI: `http://localhost:3000/docs`  
Health check: `http://localhost:3000/health`

---

## API Reference

### Auth (`/api/auth`)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `POST` | `/api/auth/register` | Public | Create account + organisation |
| `POST` | `/api/auth/login` | Public | Returns JWT |
| `GET` | `/api/auth/me` | JWT | Current user info |

**Register / Login body:**
```json
{ "email": "you@example.com", "password": "atleast8chars" }
```

**Login response:**
```json
{ "token": "eyJ..." }
```

Pass the token as `Authorization: Bearer <token>` on every control-plane request.

---

### Projects (`/api/projects`)

| Method | Path | Role | Description |
|--------|------|------|-------------|
| `GET` | `/api/projects` | Any | List projects for current org |
| `POST` | `/api/projects` | ADMIN/MEMBER | Create project |
| `GET` | `/api/projects/:id` | Any | Get project |
| `PUT` | `/api/projects/:id` | ADMIN/MEMBER | Update project |
| `DELETE` | `/api/projects/:id` | ADMIN | Delete project |

---

### Environments (`/api/projects/:projectId/environments`)

| Method | Path | Role | Description |
|--------|------|------|-------------|
| `GET` | `.../environments` | Any | List environments |
| `POST` | `.../environments` | ADMIN/MEMBER | Create environment (API key auto-generated as `vex_…`) |
| `GET` | `.../environments/:id` | Any | Get environment |
| `PUT` | `.../environments/:id` | ADMIN/MEMBER | Update environment |
| `DELETE` | `.../environments/:id` | ADMIN | Delete environment |

---

### Flags (`/api/projects/:projectId/flags`)

| Method | Path | Role | Description |
|--------|------|------|-------------|
| `GET` | `.../flags` | Any | List flags |
| `POST` | `.../flags` | ADMIN/MEMBER | Create flag |
| `GET` | `.../flags/:id` | Any | Get flag |
| `PUT` | `.../flags/:id` | ADMIN/MEMBER | Update flag |
| `DELETE` | `.../flags/:id` | ADMIN | Delete flag |

Flag types: `boolean`, `string`, `number`, `json`.

---

### Flag Config (`/api/projects/:projectId/flags/:flagId/config/:environmentId`)

| Method | Path | Role | Description |
|--------|------|------|-------------|
| `GET` | `.../config/:envId` | Any | Get strategy config |
| `PUT` | `.../config/:envId` | ADMIN/MEMBER | Upsert strategy + optional scheduled change. Busts Redis cache. |

---

### Segments (`/api/projects/:projectId/segments`)

| Method | Path | Role | Description |
|--------|------|------|-------------|
| `GET` | `.../segments` | Any | List segments |
| `POST` | `.../segments` | ADMIN/MEMBER | Create segment |
| `PUT` | `.../segments/:id` | ADMIN/MEMBER | Update segment |
| `DELETE` | `.../segments/:id` | ADMIN | Delete segment |

---

### Analytics (`/api/projects/:projectId/analytics`)

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `.../analytics` | Aggregated evaluation stats per flag/environment |

---

### Audit Logs (`/api/projects/:projectId/audit-logs`)

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `.../audit-logs` | Paginated immutable audit trail |

---

### Data Plane (SDK endpoints)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `POST` | `/v1/flags/evaluate` | API key | Evaluate all flags for a user context |
| `POST` | `/v1/events` | API key | Ingest a batch of analytics events |

**`POST /v1/flags/evaluate`** — send the environment API key as `Authorization: Bearer vex_...`

```json
// Request
{
  "context": {
    "userId": "u_42",
    "country": "US",
    "plan": "pro"
  }
}

// Response
{
  "flags": {
    "new-checkout": { "value": true,  "type": "boolean", "reason": "ROLLOUT_IN" },
    "ui-theme":     { "value": "dark","type": "string",  "reason": "BOOLEAN"    }
  }
}
```

**`POST /v1/events`**

```json
{
  "events": [
    { "flagKey": "new-checkout", "result": true,  "context": { "userId": "u_42" } },
    { "flagKey": "ui-theme",     "result": false, "context": { "userId": "u_42" } }
  ]
}
```

---

## Rate Limits

| Endpoint group | Limit |
|---------------|-------|
| `POST /api/auth/register` | 5 / day per IP |
| `POST /api/auth/login` | 10 / 15 min per IP |
| Control plane writes | 50 / day per user |
| Control plane reads | 200 / day per user |
| `POST /v1/flags/evaluate` | `MAX_EVAL_PER_DAY` (default 100) / day per API key |
| `POST /v1/events` | 50 / day per API key |

---

## Testing

```bash
# All tests
npm test

# Subsets
npm run test:unit         # Unit tests (services, strategies, engine)
npm run test:integration  # Route integration tests (in-process test app)
npm run test:security     # RBAC, org isolation, injection tests
npm run test:rate-limit   # Token-bucket rate limit tests

# Coverage report
npm run test:coverage
```

Tests run with Vitest + SWC. Integration tests spin up a real in-process Fastify instance with SQLite/in-memory Redis — no Docker required.

---

## Database Migrations

Vexil uses TypeORM migrations for all schema changes. `synchronize: true` is disabled — the schema is never auto-modified at runtime.

### How it works

| Context | What runs migrations |
|---------|---------------------|
| Docker / production | `run_start.sh` runs migrations automatically before the server starts |
| Local dev (first time) | `npm run migration:run` (one-time manual step) |
| CI pipeline | `npm run migration:run` in the test job before running tests |
| New migration needed | `npm run migration:generate -- src/migrations/MyChange` |

### NPM scripts

```bash
# Apply all pending migrations (idempotent — safe to run multiple times)
npm run migration:run

# Undo the most recently applied migration
npm run migration:revert

# Show which migrations have been applied and which are pending
npm run migration:show

# Generate a new migration by diffing entity definitions against the DB schema
# Replace <MigrationName> with a short PascalCase description of the change
npm run migration:generate -- src/migrations/<MigrationName>
```

> `migration:generate` requires a running PostgreSQL instance (reads the current schema to compute the diff). Make sure `docker compose up -d postgres` is running first.

### First-time local setup

```bash
# 1. Start PostgreSQL
docker compose up -d postgres

# 2. Apply the initial schema migration (creates all 9 tables)
cd apps/api
npm run migration:run
# Output: Applied migration: InitialSchema1744588800000
```

### Adding a new migration

1. Modify one or more entity files in `src/entities/`
2. Generate the migration:
   ```bash
   npm run migration:generate -- src/migrations/AddFlagDescription
   # TypeORM diffs the entities vs the live DB and writes the SQL automatically
   ```
3. Review the generated file in `src/migrations/` — check the `up()` and `down()` SQL
4. Apply it:
   ```bash
   npm run migration:run
   ```
5. Commit the migration file alongside the entity change

### Rolling back a migration

```bash
npm run migration:revert
# Runs the down() method of the last applied migration
# Run again to revert one more step
```

### Existing database (upgrading from synchronize: true)

If your database was previously created by TypeORM's `synchronize: true`, all tables already exist. The initial migration uses `IF NOT EXISTS` guards so it is safe to run — it will record itself as applied without touching existing tables:

```bash
npm run migration:run
# Output: No pending migrations — schema is up to date.
# (The InitialSchema migration is recorded in the migrations table)
```

### Migration files location

```
apps/api/src/migrations/
└── 1744588800000-InitialSchema.ts   ← baseline covering all 9 entities
    <timestamp>-<Name>.ts            ← future migrations added here
```

Compiled output (used in production): `apps/api/dist/migrations/*.js`

---

## Production Build

```bash
npm run build   # emits dist/
npm start       # runs dist/server.js
```

Docker (multi-stage Alpine build — see `Dockerfile` in this directory):
```bash
docker build -t vexil-api .
docker run -p 3000:3000 --env-file .env vexil-api
```

---

## Project Structure

```
apps/api/src/
├── server.ts               # Entry point — boots DataSource + Redis, then buildApp()
├── app.ts                  # Fastify factory: CORS, rate limits, security headers, route registration
├── openapi.ts              # Swagger / OpenAPI spec registration
├── controllers/            # Request handlers (parse → call service → reply)
├── services/               # Business logic (no HTTP coupling)
│   ├── EvaluationService   # Orchestrates engine, manages Redis cache
│   ├── SchedulerService    # 60s poll for scheduled flag activations
│   └── ...
├── evaluation/
│   ├── EvaluationEngine.ts # Iterates configs, calls strategy, collects results
│   ├── StrategyFactory.ts  # Instantiates + validates strategy from DB config
│   └── strategies/         # One file per strategy (Boolean, Rollout, AB, …)
├── entities/               # TypeORM entities (DB schema)
├── middleware/
│   ├── authMiddleware.ts   # JWT decode → request.user
│   ├── rbacMiddleware.ts   # requireRole() hook factory
│   └── evalThrottle.ts     # Per-API-key token-bucket check
├── routes/                 # Fastify route registrations + JSON schema validation
│   └── schemas/            # JSON Schema files used for request validation
└── utils/                  # redis client, ruleEngine, extractApiKey, …
```
