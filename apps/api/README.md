# @vexil/api

Fastify backend for Vexil. Two HTTP planes:

- **`/api/*`** — JWT auth. Used by the dashboard for CRUD.
- **`/v1/*`** — API-key auth. Used by SDK clients to evaluate flags.

---

## Run it locally

You need Node 18+, npm 9+, and Docker (for Postgres + Redis).

```bash
# 1. From the repo root — start Postgres + Redis only
docker compose up -d postgres redis

# 2. Install workspace deps (also from the repo root)
npm install

# 3. Configure environment
cp apps/api/.env.example apps/api/.env
# Set JWT_SECRET in apps/api/.env. Generate one with:
#   openssl rand -hex 32

# 4. Apply migrations (creates all 8 tables)
cd apps/api && npm run migration:run

# 5. Start the dev server (from repo root)
npm run dev:api
```

API at http://localhost:3000 · Swagger at `/docs` · Health at `/health`.

> Prefer one command? Run `docker compose up --build` from the repo root — it starts everything (API + dashboard + DB + Redis) and applies migrations.

---

## Environment variables

| Variable | Default | Notes |
|---|---|---|
| `JWT_SECRET` | — | **Required.** Generate with `openssl rand -hex 32`. Server refuses to start without it. |
| `PORT` | `3000` | |
| `DB_HOST` / `DB_PORT` / `DB_USER` / `DB_PASS` / `DB_NAME` | `127.0.0.1` / `5432` / `postgres` / `postgres` / `vexil` | |
| `REDIS_HOST` / `REDIS_PORT` | `127.0.0.1` / `6379` | |
| `WEB_URL` | `http://localhost:5173` | Allowed CORS origin |
| `MAX_EVAL_PER_DAY` | `100` | Cap on `/v1/flags/evaluate` per API key per day |
| `EVAL_BUCKET_CAPACITY` / `EVAL_REFILL_RATE_MS` | `5` / `2000` | Per-API-key token bucket (burst / refill) |

---

## Endpoints — control plane (`/api/*`, JWT)

| Group | Routes |
|---|---|
| Auth (`/api/auth`) | `POST /register` · `POST /login` · `GET /me` |
| Projects | `GET POST /projects`, `GET PUT DELETE /projects/:id` |
| Environments | `GET POST /projects/:projectId/environments`, `GET PUT DELETE /environments/:id` (POST issues a `vex_…` API key) |
| Flags | `GET POST /projects/:projectId/flags`, `GET PUT DELETE /flags/:id` |
| Flag config | `GET PUT /projects/:projectId/flags/:flagId/config/:envId` (PUT busts Redis cache) |
| Segments | `GET POST /projects/:projectId/segments`, `PUT DELETE /segments/:id` |
| Audit logs | `GET /projects/:projectId/audit-logs` |

Roles: ADMIN can do everything, MEMBER can read/write, VIEWER is read-only. Org isolation is enforced server-side on every object — there's no way to query across organisations.

Full request/response shapes in Swagger at `/docs`.

---

## Endpoint — data plane (`/v1/*`, API key)

`POST /v1/flags/evaluate` — evaluate every flag in the environment for a user context.

```bash
curl -X POST http://localhost:3000/v1/flags/evaluate \
  -H "Authorization: Bearer vex_..." \
  -H "Content-Type: application/json" \
  -d '{ "context": { "userId": "u_42", "country": "US", "plan": "pro" } }'
```

```json
{ "flags": {
  "new-checkout": { "value": true,  "type": "boolean", "reason": "ROLLOUT_IN" },
  "ui-theme":     { "value": "dark", "type": "string",  "reason": "BOOLEAN"    }
}}
```

---

## Rate limits

| Endpoint | Limit |
|---|---|
| `POST /api/auth/register` | 5 / day / IP |
| `POST /api/auth/login` | 10 / 15 min / IP |
| Control plane writes / reads | 50 / 200 per day per user |
| `POST /v1/flags/evaluate` | `MAX_EVAL_PER_DAY` (default 100) per API key, **plus** a token-bucket smoother (`EVAL_BUCKET_CAPACITY` burst, refilled every `EVAL_REFILL_RATE_MS`) |

---

## Tests

```bash
npm test                  # all suites
npm run test:unit
npm run test:integration
npm run test:security
npm run test:rate-limit
npm run test:coverage
```

Vitest + SWC. Integration tests use a stubbed ORM and in-memory Redis — no Docker needed.

---

## Migrations

Schema changes go through TypeORM migrations in `src/migrations/`. `synchronize` is always off.

```bash
npm run migration:run        # apply pending
npm run migration:revert     # undo last
npm run migration:show       # status

# After editing an entity, generate a new migration:
npm run migration:generate -- src/migrations/MyChange
```

`migration:generate` reads the live schema, so Postgres must be running. In Docker / production, `run_start.sh` applies pending migrations automatically before the server boots.

---

## Build

```bash
npm run build   # → dist/
npm start       # node dist/server.js
```

Docker image (multi-stage Alpine):

```bash
docker build -t vexil-api .
docker run -p 3000:3000 --env-file .env vexil-api
```
