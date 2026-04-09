# Vexil

> Self-hosted feature flag platform — deterministic rollouts, multiple targeting strategies, real-time evaluation, and a built-in analytics pipeline.

---

## Repository Layout

```
vexil/
├── apps/
│   ├── api/          # Fastify backend — control + data plane
│   └── web/          # React admin dashboard
├── packages/
│   ├── sdk-js/       # @vexil/sdk-js — JS/TS SDK (publishable npm package)
│   └── types/        # @vexil/types — shared TypeScript types
├── docker-compose.yml
└── railway.toml      # Railway deployment config
```

---

## Architecture

```mermaid
graph TB
    classDef client fill:#4f46e5,stroke:#3730a3,color:#fff
    classDef sdk fill:#0891b2,stroke:#0e7490,color:#fff
    classDef plane fill:#1e293b,stroke:#334155,color:#e2e8f0
    classDef infra fill:#166534,stroke:#14532d,color:#fff

    subgraph clients["Client Applications"]
        APP1["Web App"]:::client
        APP2["Node.js Service"]:::client
    end

    subgraph sdk["@vexil/sdk-js"]
        SDKJS["VexilClient\npolling · analytics buffer"]:::sdk
    end

    subgraph control["Control Plane"]
        DASH["React Dashboard\napps/web :5173"]:::plane
        API["Fastify API\n/api/* — JWT auth\n:3000"]:::plane
        SCHED["SchedulerService\n60s poll → scheduled changes"]:::plane
    end

    subgraph data["Data Plane"]
        EVAL["POST /v1/flags/evaluate\nAPI key auth"]:::plane
        EVENTS["POST /v1/events\nanalytics ingest"]:::plane
    end

    subgraph infra["Infrastructure"]
        PG[("PostgreSQL\nsource of truth")]:::infra
        REDIS[("Redis\n30s config TTL\n5min env TTL")]:::infra
    end

    APP1 & APP2 --> SDKJS
    SDKJS --> EVAL
    SDKJS --> EVENTS
    DASH --> API
    API --> PG
    API --> REDIS
    EVAL --> REDIS
    EVAL --> PG
    EVENTS --> PG
    SCHED --> PG
    SCHED --> REDIS
```

---

## Flag Evaluation Flow

```mermaid
sequenceDiagram
    autonumber
    participant App as Client App
    participant SDK as VexilClient
    participant API as /v1/flags/evaluate
    participant Cache as Redis
    participant DB as PostgreSQL

    App->>SDK: init({ userId, country, tier })
    SDK->>API: POST /v1/flags/evaluate<br/>Bearer vex_...
    API->>Cache: Lookup env by API key (TTL 5m)
    alt cache miss
        Cache-->>API: miss
        API->>DB: SELECT environment WHERE api_key = ?
        API->>Cache: cache env (TTL 5m)
    end
    API->>Cache: Lookup flag configs (TTL 30s)
    alt cache miss
        Cache-->>API: miss
        API->>DB: SELECT flag_environment_configs
        API->>Cache: cache configs (TTL 30s)
    end
    API->>API: EvaluationEngine.evaluate(configs, context)
    Note over API: Per flag: Boolean → Rollout → UserTargeting<br/>→ AttributeMatching → A/B Test → TimeWindow → Prerequisite
    API-->>SDK: { flags: { key: { value, type, variant, reason } } }
    SDK->>SDK: cache in memory + start polling (default 30s)
    SDK-->>App: FlagMap — zero-latency reads

    loop Every 30s (polling) or 1000 events (flush)
        SDK->>API: POST /v1/events (batch analytics)
        API->>DB: INSERT evaluation_events
    end
```

---

## Evaluation Strategies

```mermaid
flowchart TD
    classDef decision fill:#1e40af,stroke:#1e3a8a,color:#fff,rx:8
    classDef terminal fill:#166534,stroke:#14532d,color:#fff
    classDef terminalFail fill:#991b1b,stroke:#7f1d1d,color:#fff
    classDef strategy fill:#0f172a,stroke:#334155,color:#e2e8f0

    START([Evaluate flag]) --> ENABLED{Flag enabled?}:::decision
    ENABLED -- No --> DEFAULT([default value]):::terminalFail
    ENABLED -- Yes --> STRATEGY{Strategy}:::decision

    STRATEGY --> BOOL["Boolean\nreturn configured value"]:::strategy
    STRATEGY --> ROLLOUT["Rollout\ndjb2(userId + flagKey) % 100"]:::strategy
    STRATEGY --> USER["User Targeting\nuserId in whitelist?"]:::strategy
    STRATEGY --> ATTR["Attribute Matching\nall rules pass? (AND logic)"]:::strategy
    STRATEGY --> TARGETED["Targeted Rollout\nrules match AND rollout bucket"]:::strategy
    STRATEGY --> AB["A/B Test\nweighted variant assignment"]:::strategy
    STRATEGY --> TIME["Time Window\nnow between start/end UTC?"]:::strategy
    STRATEGY --> PREREQ["Prerequisite\nother flag == expected value\nmax depth 3"]:::strategy

    ROLLOUT --> HASH_CHECK{bucket < %?}:::decision
    HASH_CHECK -- Yes --> PASS([ROLLOUT_IN]):::terminal
    HASH_CHECK -- No --> FAIL([ROLLOUT_OUT]):::terminalFail

    PREREQ --> RECURSE["evaluate prerequisite flag"]:::strategy
    RECURSE --> PREREQ_CHECK{value matches?}:::decision
    PREREQ_CHECK -- Yes --> PASS2([evaluate this flag]):::terminal
    PREREQ_CHECK -- No --> DEFAULT2([default value]):::terminalFail
```

---

## Data Model

```mermaid
erDiagram
    ORGANIZATION {
        uuid id PK
        string name
    }
    USER {
        uuid id PK
        string email
        string password_hash
        enum role "ADMIN | MEMBER | VIEWER"
        uuid org_id FK
    }
    PROJECT {
        uuid id PK
        string name
        uuid org_id FK
    }
    ENVIRONMENT {
        uuid id PK
        string name
        string api_key "vex_..."
        uuid project_id FK
    }
    FLAG {
        uuid id PK
        string key
        string name
        enum type "boolean | string | number | json"
        uuid project_id FK
    }
    FLAG_ENVIRONMENT_CONFIG {
        uuid id PK
        boolean is_enabled
        enum strategy_type
        jsonb strategy_config
        timestamp scheduled_change_at
        jsonb scheduled_change_config
        uuid flag_id FK
        uuid environment_id FK
    }
    SEGMENT {
        uuid id PK
        string name
        jsonb conditions
        uuid project_id FK
    }
    EVALUATION_EVENT {
        uuid id PK
        string flag_key
        boolean result
        jsonb context_snapshot
        timestamp created_at
        uuid environment_id FK
    }
    AUDIT_LOG {
        uuid id PK
        string action
        jsonb payload
        timestamp created_at
        uuid project_id FK
        uuid user_id FK
    }

    ORGANIZATION ||--o{ USER : has
    ORGANIZATION ||--o{ PROJECT : owns
    PROJECT ||--o{ ENVIRONMENT : has
    PROJECT ||--o{ FLAG : defines
    PROJECT ||--o{ SEGMENT : defines
    PROJECT ||--o{ AUDIT_LOG : tracks
    FLAG ||--o{ FLAG_ENVIRONMENT_CONFIG : "configured per env"
    ENVIRONMENT ||--o{ FLAG_ENVIRONMENT_CONFIG : "stores configs"
    ENVIRONMENT ||--o{ EVALUATION_EVENT : records
```

---

## Analytics Pipeline

```mermaid
flowchart LR
    classDef sdk fill:#0891b2,stroke:#0e7490,color:#fff
    classDef api fill:#1e293b,stroke:#334155,color:#e2e8f0
    classDef db fill:#166534,stroke:#14532d,color:#fff

    subgraph sdk["SDK (client-side)"]
        EVAL_CALL["client.init()"]:::sdk
        BUFFER["In-Memory Buffer\nMap&lt;flagKey, count&gt;"]:::sdk
        FLUSH{"Flush trigger:\n30s interval OR 1000 events"}:::sdk
    end

    subgraph api["Data Plane (apps/api)"]
        ENDPOINT["POST /v1/events"]:::api
        INSERT["INSERT evaluation_events\n(batch, fire-and-forget)"]:::api
    end

    subgraph db["PostgreSQL"]
        EVENTS_TABLE[("evaluation_events")]:::db
        STATS["Aggregated stats\nper project / env / flag"]:::db
    end

    EVAL_CALL --> BUFFER
    BUFFER --> FLUSH
    FLUSH -->|batch POST| ENDPOINT
    ENDPOINT --> INSERT
    INSERT --> EVENTS_TABLE
    EVENTS_TABLE -->|GROUP BY| STATS
```

---

## Getting Started (Local Dev)

### Prerequisites

- Node.js >= 18
- Docker (PostgreSQL + Redis via `docker-compose.yml`)
- npm >= 9

### 1. Clone and install

```bash
git clone https://github.com/your-org/vexil.git
cd vexil
npm install
```

### 2. Start infrastructure

```bash
docker compose up -d
# PostgreSQL on :5432, Redis on :6379
```

### 3. Configure the API

```bash
cd apps/api
cp .env.example .env
```

| Variable | Default | Description |
|---|---|---|
| `PORT` | `3000` | Fastify listen port |
| `DB_HOST` | `127.0.0.1` | PostgreSQL host |
| `DB_PORT` | `5432` | PostgreSQL port |
| `DB_USER` | `postgres` | PostgreSQL username |
| `DB_PASS` | `postgres` | PostgreSQL password |
| `DB_NAME` | `vexil` | Database name |
| `REDIS_HOST` | `127.0.0.1` | Redis host |
| `REDIS_PORT` | `6379` | Redis port |
| `JWT_SECRET` | `vexil-dev-secret` | Change in production |
| `NODE_ENV` | `development` | Set to `test` for in-memory Redis mock |

### 4. Start API + dashboard

```bash
# From monorepo root
npm run dev:api    # API at http://localhost:3000  |  Swagger at http://localhost:3000/docs
npm run dev:web    # Dashboard at http://localhost:5173
```

Register an account → create a project → add environments → create flags → configure strategies.

---

## SDK Quick Start

### Install

```bash
npm install @vexil/sdk-js
```

### Basic usage

```typescript
import { VexilClient } from "@vexil/sdk-js";

const client = new VexilClient({
  apiKey: "vex_...",                  // environment API key from Dashboard → Environments
  baseUrl: "https://api.example.com",
  pollingInterval: 30_000,            // re-fetch flags every 30s (default)
  onFlagsUpdated: (flags) => console.log("flags refreshed", flags),
  onError: (err) => console.error(err),
});

// Fetch flags for a user context — call once at startup
await client.init({ userId: "u_42", country: "IN", tier: "premium" });

// Zero-latency reads from in-memory cache
if (client.isEnabled("new-checkout")) {
  renderNewCheckout();
}

const theme = client.getValue<string>("ui-theme", "light");   // typed with fallback
const limit = client.getValue<number>("rate-limit", 100);

// Switch user context (e.g. on login)
await client.identify({ userId: "u_99", tier: "free" });

// Graceful shutdown — flushes analytics and stops polling
await client.destroy();
```

### EvaluationContext

Any key you pass in the context is forwarded to the API for attribute matching rules.

```typescript
await client.init({
  userId: "u_42",          // used for rollout bucketing + user targeting
  country: "US",           // available for attribute matching
  plan: "pro",             // custom attribute
  betaTester: true,        // custom attribute
});
```

### Strategy config reference

| Strategy | Required `strategyConfig` fields |
|---|---|
| `boolean` | `value: boolean` |
| `rollout` | `percentage: number (0–100)`, `hashAttribute: string` |
| `user_targeting` | `userIds: string[]`, `hashAttribute: string`, `fallthrough: boolean` |
| `attribute_matching` | `rules: TargetingRule[]` |
| `targeted_rollout` | `percentage`, `hashAttribute`, `rules: TargetingRule[]` |
| `ab_test` | `variants: { key, value, weight }[]` (weights sum to 100), `hashAttribute: string` |
| `time_window` | `startDate: string (ISO)`, `endDate: string (ISO)`, `timezone?: string` |
| `prerequisite` | `flagKey: string`, `expectedValue: unknown` |

> `hashAttribute` defaults to `"userId"` in the dashboard. It determines which context field is used for deterministic bucketing.

---

## Demo App

A standalone demo exercises all strategy types end-to-end.

```bash
# Prerequisites: API running on :3000, flags configured in dashboard
cd /path/to/vexil-demo
cp .env.example .env      # set VEXIL_API_KEY from Dashboard → Environments → Show key
npm install
npm run demo
```

Expected output — each flag resolves with a reason code:

| Flag | Strategy | Alice (pro, US) | Charlie (free, DE) |
|---|---|---|---|
| `boolean-test-flag` | Boolean | `ENABLED` | `ENABLED` |
| `rollout-test-flag` | Rollout 50% | `ROLLOUT_OUT` | `ROLLOUT_IN` |
| `user-targeting-test-flag` | User Targeting | `USER_WHITELIST` | `USER_FALLTHROUGH` |
| `ab-test-flag` | A/B Test | `AB_VARIANT` | `AB_VARIANT` |

---

## Deployment (Railway)

Config in `railway.toml` — two services: `api` and `web`.

**API env vars:**

| Variable | Description |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string (Railway plugin) |
| `REDIS_URL` | Redis connection string (Railway plugin) |
| `JWT_SECRET` | Random secret, min 32 chars |
| `NODE_ENV` | `production` |
| `PORT` | `3000` |

**Web env vars:**

| Variable | Description |
|---|---|
| `VITE_API_URL` | Deployed API URL, e.g. `https://vexil-api.up.railway.app` |

---

## Features

| Area | Capabilities |
|---|---|
| Auth | JWT register/login, RBAC (ADMIN / MEMBER / VIEWER) |
| Management | Projects, Environments, Flags CRUD, API key rotation |
| Strategies | Boolean, Rollout, User Targeting, Attribute Matching, Targeted Rollout, A/B Test, Time Window, Prerequisite |
| Targeting | Segment builder with visual rule editor |
| Scheduling | Per-flag scheduled activation with `scheduledAt` |
| Analytics | Evaluation event buffering, pass-rate dashboard |
| Audit | Full audit log per project |
| Performance | Redis cache (30s config / 5min env TTL), cache-busted on save |
| SDK | JS/TS — polling, analytics buffering, typed API |
| API Docs | Swagger UI at `/docs` |

---

**Vexil — Performance + Determinism + Developer Experience**
