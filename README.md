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
    Team([You / Team]) --> Dash[Dashboard<br/>:5173]
    Dash -->|"create &amp; configure flags"| API[Vexil API<br/>:3000]
    API --> DB[(Postgres<br/>+ Redis cache)]

    YourApp[Your App] -->|"isEnabled('checkout')"| SDK[@vexil/sdk-js]
    SDK -->|"POST /v1/flags/evaluate<br/>every 30s"| API
```

Three moving parts:

1. **Dashboard** — where you and your team create flags and pick rules.
2. **API** — stores everything in Postgres, answers evaluation requests, caches hot reads in Redis.
3. **SDK** — drops into your app, asks the API once at startup + every 30 seconds, serves answers from memory.

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
