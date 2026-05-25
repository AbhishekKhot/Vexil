# Vexil

**A self-hosted feature flag service.** Turn features on or off for selected users without redeploying your app.

---

## What is a feature flag?

A feature flag is a remote switch for code you've already shipped. Instead of hard-coding `if (newCheckout) { ... }`, your app asks Vexil _"is `new-checkout` on for this user?"_ Vexil decides based on rules you set in a dashboard — for example: 10% of all users, only users in the US on the Pro plan, or a 50/50 A/B test.

You change the rule in the dashboard; your app picks it up within ~60 seconds. No redeploy.

---

## How Vexil works

```mermaid
flowchart LR
    Team(["End User"]) --> Dash["Dashboard<br/>:5173"]
    Dash -->|"create and configure flags"| API["Vexil API<br/>:3000"]
    API --> DB[("Postgres<br/>+ Redis cache")]

    YourApp["Client App"] -->|"isEnabled('checkout')"| SDK["vexil/sdk-js"]
    SDK -->|"POST /v1/flags/evaluate every 30s"| API
```

Three moving parts:

1. **Dashboard** — where the end user (you / your team) creates flags and picks rules.
2. **API** — stores everything in Postgres, answers evaluation requests, caches hot reads in Redis.
3. **SDK** — drops into your client app, asks the API once at startup + every 30 seconds, serves answers from memory.

---

## Flag evaluation — request / response flow

What happens when the client app asks Vexil to evaluate flags:

```mermaid
sequenceDiagram
    autonumber
    participant App as Client App
    participant SDK as VexilClient
    participant API as Vexil API
    participant Redis
    participant DB as Postgres

    App->>SDK: client.init({ userId, country, plan })
    SDK->>API: POST /v1/flags/evaluate (Bearer vex_...)
    Note over API: token-bucket check<br/>(Redis key eval_bucket:{apiKey})
    API->>Redis: GET env_apikey:{apiKey}
    alt cache miss
        API->>DB: SELECT environment WHERE apiKey = ?
        API->>Redis: SET env_apikey (TTL 5 min)
    end
    API->>Redis: GET env_configs:{envId}
    alt cache miss
        API->>DB: SELECT flag_environment_configs WHERE envId = ?
        API->>Redis: SET env_configs (TTL 30 s)
    end
    Note over API: EvaluationEngine loops every flag<br/>→ StrategyFactory → strategy.evaluate(ctx)<br/>(errors per flag isolated → reason ERROR)
    API-->>SDK: { flags: key -> { value, type, variant, reason } }
    SDK->>SDK: cache in memory, fire onFlagsUpdated
    SDK-->>App: ready

    App->>SDK: client.isEnabled('new-checkout')
    SDK-->>App: true  (synchronous read, no network)

    loop every 30 s in background
        SDK->>API: POST /v1/flags/evaluate (refresh)
    end
```

Specifics worth noting:

- **Authorization** — data-plane auth is the environment API key, sent as `Bearer vex_…`. No JWT.
- **Two-layer cache** — env lookup (5 min) + flag configs (30 s). Both stored in Redis. Cold path hits Postgres; warm path is in-process.
- **Failure isolation** — a broken strategy config for one flag returns `reason: "ERROR"` for that flag only; the rest still evaluate.
- **Determinism** — rollout/AB test bucketing uses `djb2(userId + flagKey) % 100`, so the same user always lands in the same bucket for the same flag.
- **Client-side reads are free** — once `init()` returns, `isEnabled()` / `getValue()` are synchronous in-memory lookups. The 30 s background poll keeps the cache fresh.

---

## Dashboard flow — creating and configuring a flag

What happens when the end user manages flags via the dashboard:

```mermaid
sequenceDiagram
    autonumber
    participant User as End User
    participant Dash as Dashboard
    participant API as Vexil API
    participant DB as Postgres
    participant Redis

    Note over User,Dash: 1. Log in
    User->>Dash: email + password
    Dash->>API: POST /api/auth/login
    API->>DB: SELECT user, bcrypt.compare(password)
    API-->>Dash: { token } (JWT, 8 h)
    Dash->>Dash: store JWT, attach as Bearer on every request

    Note over User,Dash: 2. Create a flag
    User->>Dash: New Flag (key, name, type)
    Dash->>API: POST /api/projects/:id/flags
    Note over API: requireRole(ADMIN, MEMBER)<br/>verify project.org === user.org
    API->>DB: INSERT INTO flags
    API->>DB: INSERT INTO audit_logs
    API-->>Dash: { id, key, type, ... }

    Note over User,Dash: 3. Configure strategy per environment
    User->>Dash: pick "rollout 25%" for prod
    Dash->>API: PUT /api/projects/:id/flags/:flagId/config/:envId
    API->>DB: UPSERT flag_environment_configs<br/>(strategyType, strategyConfig)
    API->>Redis: DEL env_configs:{envId}  (bust cache)
    API->>DB: INSERT INTO audit_logs
    API-->>Dash: { isEnabled, strategyType, strategyConfig }

    Note over User,Dash: 4. Optional — schedule a future change
    User->>Dash: set scheduledAt + scheduledConfig
    Dash->>API: PUT .../config/:envId (with schedule fields)
    API->>DB: UPSERT with scheduled_change_at, scheduled_change_config
    Note over API: SchedulerService polls every 60 s<br/>→ promotes scheduled config when due<br/>→ busts env_configs cache

    Note over User,Dash: SDK clients pick up the new config on their next poll (≤ 30 s)
```

Specifics worth noting:

- **Auth** — every control-plane request needs the JWT in `Authorization: Bearer <token>`. Tokens expire after 8 hours.
- **RBAC** — `ADMIN` = full access, `MEMBER` = create/update, `VIEWER` = read-only. Roles checked per route.
- **Org isolation** — every write verifies the project belongs to the caller's organisation. Cross-org access returns 404 (never leaks existence).
- **Audit trail** — every create / update / delete writes an immutable row to `audit_logs` (who, what, before/after).
- **Cache invalidation** — saving a flag config does `DEL env_configs:{envId}` in Redis so the next SDK poll sees the change instantly instead of waiting for the 30 s TTL.
- **Scheduled rollouts** — `SchedulerService` runs on a 60 s timer in the API process; it promotes the `scheduled_change_config` to live when `scheduled_change_at` is reached.

---

## Run it (one command)

You need Docker. Then from the repo root:

```bash
cp .env.example .env
# Open .env and set JWT_SECRET. Generate one with:
#   openssl rand -hex 32
docker compose up --build
```

This starts Postgres, Redis, the API, and the dashboard. Database migrations run automatically.

| Service | URL |
|---|---|
| Dashboard | http://localhost:5173 |
| API | http://localhost:3000 |
| API docs (Swagger) | http://localhost:3000/docs |

**First-time walkthrough:**

1. Open the dashboard → register an account (you become ADMIN).
2. Create a **project**, then add an **environment** (e.g. `development`). It generates an API key starting with `vex_…`.
3. Create a **flag**, click **Configure**, pick a strategy.
4. Wire the SDK into your app:

```ts
import { VexilClient } from "@vexil/sdk-js";

const client = new VexilClient({
  apiKey: "vex_...",                  // from the Environments tab
  baseUrl: "http://localhost:3000",
});
await client.init({ userId: "user-123", country: "US" });

if (client.isEnabled("new-checkout")) showNewCheckout();
```

Prefer running natively? See [apps/api/README.md](apps/api/README.md) and [apps/web/README.md](apps/web/README.md).

---

## Repository layout

```
apps/
  api/        Fastify backend (Postgres + Redis)   → apps/api/README.md
  web/        React dashboard                       → apps/web/README.md
packages/
  sdk-js/     JS / TS SDK (npm package)             → packages/sdk-js/README.md
  types/      shared TypeScript types
```

---

## Targeting strategies

Each flag picks **one** strategy per environment:

| Strategy | When to use |
|---|---|
| **Boolean** | Simple on/off for everyone |
| **Rollout** | Gradually enable for X% of users — same user always lands in the same bucket |
| **User targeting** | Allowlist specific user IDs |
| **Attribute matching** | "Only users where `country = US` and `plan = pro`" |
| **Targeted rollout** | Attribute rules **and** a percentage |
| **A/B test** | Split users into named variants by weight |
| **Time window** | Auto-on between two UTC timestamps |
| **Prerequisite** | Only on if another flag is also on (max 3 levels deep) |

Rollouts are deterministic: `djb2(userId + flagKey) % 100` < percentage. The same user gets the same answer for the same flag every time, so users don't "flicker" in and out.

---

## Data model

```
Organization
 ├── User                       (ADMIN / MEMBER / VIEWER)
 └── Project
      ├── Environment           (each has its own vex_… API key)
      ├── Flag
      │    └── FlagEnvConfig    (the strategy — one row per env)
      ├── Segment               (reusable rule set)
      └── AuditLog              (who changed what, when)
```

---

## Why it stays fast

| Layer | Storage | TTL |
|---|---|---|
| API → environment by API key | Redis | 5 min |
| API → flag configs per env | Redis | 30 s (cleared on save) |
| SDK → flag values | in-memory | re-polls every 30 s |

End-to-end propagation of a dashboard change: under ~60 s. Per-request evaluation is in-process and sub-millisecond once configs are cached.

---

## Two API planes

| Plane | URL prefix | Auth | Who uses it |
|---|---|---|---|
| Control | `/api/*` | JWT (8h) | Dashboard |
| Data | `/v1/*` | API key (`vex_…`) | SDKs / your app |

Per-service details:

- **API** — endpoints, env vars, tests, migrations → [apps/api/README.md](apps/api/README.md)
- **Dashboard** — usage walkthrough, roles → [apps/web/README.md](apps/web/README.md)
- **SDK** — install, methods, reason codes → [packages/sdk-js/README.md](packages/sdk-js/README.md)
