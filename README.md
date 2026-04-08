# Vexil

> High-performance, open-source feature flag service with local evaluation and deterministic rollouts.

---

## Repository Layout

```
vexil/
├── apps/
│   ├── api/          # Fastify backend — Control + Data plane API
│   └── web/          # React 19 admin dashboard
├── packages/
│   ├── sdk-js/       # @vexil/sdk-js — publishable npm SDK
│   ├── sdk-ruby/     # Ruby SDK (stdlib only, no gem required)
│   └── types/        # @vexil/types — shared TypeScript types
├── docker-compose.yml
├── railway.toml
└── package.json      # npm workspaces root
```

---

## Architecture

```mermaid
graph TB
    subgraph clients["Client Applications"]
        APP1["Web App"]
        APP2["Node.js Service"]
        APP3["Ruby Service"]
    end

    subgraph sdk["SDKs (packages/)"]
        SDKJS["@vexil/sdk-js\npolling · analytics buffer"]
        SDKRB["sdk-ruby\nstdlib only"]
    end

    subgraph control["Control Plane — apps/api"]
        direction TB
        DASH["React Dashboard\napps/web"]
        API["Fastify API\n/api/* (JWT auth)"]
        SCHED["Scheduler\n60s poll for scheduled changes"]
    end

    subgraph data["Data Plane — apps/api"]
        EVAL["POST /v1/eval\nAPI key auth"]
        EVENTS["POST /v1/events\nanalytics ingest"]
    end

    subgraph infra["Infrastructure"]
        PG[("PostgreSQL\nsource of truth")]
        REDIS[("Redis\n30s config cache\n5min env cache")]
    end

    APP1 & APP2 --> SDKJS
    APP3 --> SDKRB
    SDKJS & SDKRB --> EVAL
    SDKJS & SDKRB --> EVENTS
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
    participant SDK as Vexil SDK
    participant API as /v1/eval (Data Plane)
    participant Cache as Redis Cache
    participant DB as PostgreSQL

    App->>SDK: fetchFlags({ userId, country, tier })
    SDK->>API: POST /v1/eval + Bearer vex_...
    API->>Cache: Lookup env by API key (TTL 5m)
    alt Cache miss
        Cache-->>API: miss
        API->>DB: SELECT environment WHERE api_key = ?
        API->>Cache: Store env (TTL 5m)
    end
    API->>Cache: Lookup flag configs (TTL 30s)
    alt Cache miss
        Cache-->>API: miss
        API->>DB: SELECT flag_environment_configs
        API->>Cache: Store configs (TTL 30s)
    end
    API->>API: EvaluationEngine.evaluate(configs, context)
    Note over API: Runs strategy chain per flag:<br/>Boolean → Rollout → UserTargeting<br/>→ AttributeMatching → A/B Test<br/>→ TimeWindow → Prerequisite
    API-->>SDK: { flags: { key: { value, type, variant, reason } } }
    SDK->>SDK: Buffer evaluation events
    SDK-->>App: FlagMap (in-memory, zero-latency checks)

    loop Every 30s or 1000 events
        SDK->>API: POST /v1/events (batch analytics)
        API->>DB: INSERT evaluation_events
    end
```

---

## Evaluation Strategies

```mermaid
flowchart TD
    START([Evaluate flag for user]) --> ENABLED{Flag enabled\nin this env?}
    ENABLED -- No --> DEFAULT([Return default value])
    ENABLED -- Yes --> STRATEGY{Strategy type}

    STRATEGY --> BOOL[Boolean\nReturn isEnabled value]
    STRATEGY --> ROLLOUT[Rollout\ndjb2hash userId+flagKey % 100\n< rollout %?]
    STRATEGY --> USER[User Targeting\nuserId in whitelist?]
    STRATEGY --> ATTR[Attribute Matching\nAll rules pass?\neq / neq / gt / lt / in / nin]
    STRATEGY --> TARGETED[Targeted Rollout\nRules match AND\nRollout bucket]
    STRATEGY --> AB[A/B Test\nWeighted bucket assignment\nReturn variant name]
    STRATEGY --> TIME[Time Window\nnow between start and end UTC?]
    STRATEGY --> PREREQ[Prerequisite\nOther flag value == expected?\nmax depth 3]

    ROLLOUT --> HASH_CHECK{bucket < %?}
    HASH_CHECK -- Yes --> PASS([Return true])
    HASH_CHECK -- No --> FAIL([Return false])

    PREREQ --> RECURSE[Recursively evaluate\nprerequisite flag]
    RECURSE --> PREREQ_CHECK{Value matches?}
    PREREQ_CHECK -- Yes --> PASS2([Evaluate this flag])
    PREREQ_CHECK -- No --> DEFAULT2([Return default])
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
        enum role "ADMIN|MEMBER|VIEWER"
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
        enum type "boolean|string|number|json"
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
    subgraph sdk["SDK (client-side)"]
        EVAL_CALL["fetchFlags()"]
        BUFFER["In-Memory Buffer\nMap&lt;flagKey, count&gt;"]
        FLUSH{"Flush trigger:\n30s interval\nOR 1000 events"}
    end

    subgraph api["Data Plane (apps/api)"]
        ENDPOINT["POST /v1/events"]
        INSERT["INSERT evaluation_events\n(batch, fire-and-forget)"]
    end

    subgraph db["PostgreSQL"]
        EVENTS_TABLE[("evaluation_events")]
        STATS["Aggregated stats\nper project/env/flag"]
    end

    EVAL_CALL --> BUFFER
    BUFFER --> FLUSH
    FLUSH -->|"batch POST"| ENDPOINT
    ENDPOINT --> INSERT
    INSERT --> EVENTS_TABLE
    EVENTS_TABLE -->|"GROUP BY"| STATS
```

---

## Getting Started (Local Dev)

### Prerequisites

- Node.js >= 18
- Docker (for PostgreSQL + Redis)
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
# Starts: PostgreSQL on :5433, Redis on :6379
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
| `DB_PORT` | `5433` | PostgreSQL port |
| `DB_USER` | `postgres` | PostgreSQL username |
| `DB_PASS` | `postgres` | PostgreSQL password |
| `DB_NAME` | `vexil` | Database name |
| `REDIS_HOST` | `127.0.0.1` | Redis host |
| `REDIS_PORT` | `6379` | Redis port |
| `JWT_SECRET` | `vexil-dev-secret` | **Change in production** |
| `NODE_ENV` | `development` | Set `test` for in-memory Redis mock |

### 4. Start the API

```bash
npm run dev:api
# API: http://localhost:3000
# Swagger UI: http://localhost:3000/docs
```

### 5. Start the dashboard

```bash
npm run dev:web
# Dashboard: http://localhost:5173
```

Register an account, create a project, add environments and flags.

---

## SDK Quick Start

### JavaScript / TypeScript

```bash
npm install @vexil/sdk-js
```

```typescript
import { VexilClient } from "@vexil/sdk-js";

const client = new VexilClient({
  apiKey: "vex_...",            // environment API key from the dashboard
  baseUrl: "https://api.example.com",
  pollingInterval: 60_000,      // optional: re-fetch every 60s
});

await client.fetchFlags({ userId: "u_42", country: "IN", tier: "premium" });

if (client.isEnabled("new-checkout")) {
  renderNewCheckout();
}

const theme = client.getValue<string>("ui-theme");   // "dark" | "light"
const limit = client.getValue<number>("rate-limit"); // 100

await client.destroy(); // flush analytics + stop timers on shutdown
```

### Ruby

```ruby
# No gem required — copy packages/sdk-ruby/lib/vexil.rb into your project
require_relative "vexil"

client = Vexil::Client.new(
  api_key: "vex_...",
  base_url: "https://api.example.com"
)

client.fetch_flags(userId: "u_42", country: "IN", tier: "premium")

render_new_checkout if client.enabled?("new-checkout")
theme = client.value("ui-theme", "light")
```

---

## Deploying to Railway

Railway runs `apps/api` and `apps/web` as separate services using the Dockerfiles in each directory.

### Steps

1. Push this repo to GitHub.
2. In the Railway dashboard, create a **New Project → Deploy from GitHub repo**.
3. Add two services: one for `apps/api`, one for `apps/web`.
4. Attach a **PostgreSQL** and **Redis** plugin to the project.
5. Set environment variables per service (see table above for API; set `VITE_API_BASE_URL` for web to the deployed API URL).
6. Deploy.

Railway will use `railway.toml` at the repo root to configure build and deploy settings.

---

## Working Features

| Feature | Status |
|---|---|
| JWT authentication (register / login) | Done |
| Projects, Environments, Flags CRUD | Done |
| API key generation + rotation | Done |
| Boolean, Rollout, Targeted Rollout strategies | Done |
| User Targeting, Attribute Matching strategies | Done |
| A/B Test, Time Window, Prerequisite strategies | Done |
| Segments with visual rule builder | Done |
| Per-environment flag configuration | Done |
| Scheduled flag changes | Done |
| Analytics dashboard (evaluations, pass rate) | Done |
| Audit logs | Done |
| Redis caching (30s config / 5min env TTL) | Done |
| JS/TS SDK with polling + analytics buffering | Done |
| Ruby SDK | Done |
| Swagger UI at `/docs` | Done |
| RBAC (ADMIN / MEMBER / VIEWER) | Done |

---

**Vexil — Performance + Determinism + Developer Experience**
