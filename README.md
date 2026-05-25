# Vexil

> Self-hosted feature flag platform — deterministic rollouts, multiple targeting strategies, and real-time evaluation.

---

## Repository Layout

```
vexil/
├── apps/
│   ├── api/          # Fastify backend — control + data plane  →  apps/api/README.md
│   └── web/          # React admin dashboard                   →  apps/web/README.md
├── packages/
│   ├── sdk-js/       # @vexil/sdk-js — JS/TS SDK (npm package) →  packages/sdk-js/README.md
│   └── types/        # @vexil/types — shared TypeScript types
└── docker-compose.yml
```

**Per-service setup guides live in each service's own README.** This document covers the overall system architecture, data model, and evaluation design.

---

## Service Architecture

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
        SDKJS["VexilClient\npolling"]:::sdk
    end

    subgraph control["Control Plane  (apps/web + /api/*)"]
        DASH["React Dashboard\n:5173"]:::plane
        API["Fastify API\n/api/* — JWT auth\n:3000"]:::plane
        SCHED["SchedulerService\n60s poll → scheduled flag changes"]:::plane
    end

    subgraph data["Data Plane  (/v1/*)"]
        EVAL["POST /v1/flags/evaluate\nAPI-key auth"]:::plane
    end

    subgraph infra["Infrastructure"]
        PG[("PostgreSQL 16\nsource of truth")]:::infra
        REDIS[("Redis 7\n30s config TTL · 5m env TTL")]:::infra
    end

    APP1 & APP2 --> SDKJS
    SDKJS --> EVAL
    DASH --> API
    API --> PG
    API --> REDIS
    EVAL --> REDIS
    EVAL --> PG
    SCHED --> PG
    SCHED --> REDIS
```

### Two-plane design

| Plane | Prefix | Auth | Purpose |
|-------|--------|------|---------|
| Control | `/api/*` | JWT (8h) | Dashboard CRUD — projects, flags, environments |
| Data | `/v1/*` | API key (`vex_…`) | SDK flag evaluation |

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
    SDK->>API: POST /v1/flags/evaluate  Bearer vex_...
    API->>Cache: Lookup env by API key (TTL 5m)
    alt cache miss
        Cache-->>API: miss
        API->>DB: SELECT environment WHERE api_key = ?
        API->>Cache: SET env (TTL 5m)
    end
    API->>Cache: Lookup flag configs (TTL 30s)
    alt cache miss
        Cache-->>API: miss
        API->>DB: SELECT flag_environment_configs
        API->>Cache: SET configs (TTL 30s)
    end
    API->>API: EvaluationEngine.evaluate(configs, context)
    Note over API: Per flag: strategy evaluated, reason code returned
    API-->>SDK: { flags: { key: { value, type, variant, reason } } }
    SDK->>SDK: in-memory cache + polling timer (default 30s)
    SDK-->>App: FlagMap — zero-latency reads
```

---

## Evaluation Strategies

Eight strategies are evaluated in strict priority order per flag:

```mermaid
flowchart TD
    classDef decision fill:#1e40af,stroke:#1e3a8a,color:#fff
    classDef terminal fill:#166534,stroke:#14532d,color:#fff
    classDef terminalFail fill:#991b1b,stroke:#7f1d1d,color:#fff
    classDef strategy fill:#0f172a,stroke:#334155,color:#e2e8f0

    START([Evaluate flag]) --> ENABLED{Flag enabled?}:::decision
    ENABLED -- No --> DEFAULT([default value]):::terminalFail
    ENABLED -- Yes --> STRATEGY{Strategy type}:::decision

    STRATEGY --> BOOL["Boolean — fixed on/off value"]:::strategy
    STRATEGY --> ROLLOUT["Rollout — djb2(userId+flagKey) % 100"]:::strategy
    STRATEGY --> USER["User Targeting — userId in whitelist"]:::strategy
    STRATEGY --> ATTR["Attribute Matching — AND rule evaluation"]:::strategy
    STRATEGY --> TARGETED["Targeted Rollout — rules AND rollout bucket"]:::strategy
    STRATEGY --> AB["A/B Test — weighted variant assignment"]:::strategy
    STRATEGY --> TIME["Time Window — now between start/end UTC"]:::strategy
    STRATEGY --> PREREQ["Prerequisite — other flag == expected value (max depth 3)"]:::strategy
```

| Strategy | Key config fields |
|----------|-------------------|
| `boolean` | `value: boolean` |
| `rollout` | `percentage: 0–100`, `hashAttribute` |
| `user_targeting` | `userIds: string[]`, `hashAttribute`, `fallthrough` |
| `attribute_matching` | `rules: TargetingRule[]` |
| `targeted_rollout` | `percentage`, `hashAttribute`, `rules` |
| `ab_test` | `variants: { key, value, weight }[]` (sum to 100), `hashAttribute` |
| `time_window` | `startDate`, `endDate` (ISO 8601), `timezone?` |
| `prerequisite` | `flagKey`, `expectedValue` |

> `hashAttribute` (default `"userId"`) is the context field used for deterministic bucketing. Rollout results are stable per user per flag.

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
```

---

## Caching Strategy

| Cache key | TTL | Invalidated on |
|-----------|-----|----------------|
| `env_apikey:{apiKey}` | 5 min | Environment update |
| `env_configs:{environmentId}` | 30 s | Flag config save |
| `eval_bucket:{apiKey}` | rolling | Token-bucket rate limit |

---

## Docker Compose (Recommended — full stack in one command)

Runs PostgreSQL, Redis, the API, and the web dashboard together. The API container automatically runs database migrations before accepting traffic.

```bash
# 1. Create your env file and set JWT_SECRET
cp .env.example .env
# Edit .env — at minimum, change JWT_SECRET:
#   JWT_SECRET=$(openssl rand -hex 32)

# 2. Build images and start everything
docker compose up --build
```

**What happens on first run:**

```
postgres  → starts, waits until pg_isready
redis     → starts, waits until redis-cli ping
api       → waits for postgres + redis to be healthy
            runs run_start.sh:
              [startup] Running database migrations...
              [startup] Applied migration: InitialSchema1744588800000
              [startup] Migrations complete.
              [startup] Starting Vexil API server...
web       → waits for api /health to return 200
            serves the React dashboard via nginx
```

**Subsequent runs** (images already built):

```bash
docker compose up
# Migrations are idempotent — "No pending migrations" on a current schema
```

**Ports:**

| Service | Host URL |
|---------|----------|
| PostgreSQL | `localhost:5432` |
| Redis | `localhost:6379` |
| API | `http://localhost:3000` — Swagger: `/docs` |
| Web | `http://localhost:5173` |

**Useful commands:**

```bash
# Rebuild only the api image after code changes
docker compose up --build api

# View api logs
docker compose logs -f api

# Stop everything (keeps volumes)
docker compose down

# Stop and delete all data (volumes)
docker compose down -v

# Run a one-off migration manually inside the running container
docker compose exec api sh -c "node -e \"const {AppDataSource}=require('./dist/data-source');AppDataSource.initialize().then(ds=>ds.runMigrations()).then(()=>process.exit(0))\""
```

---

## Quick Start (Local Dev — without Docker for the API)

> Full setup instructions are in each service's README. This is the three-command path.

```bash
# 1. Install all workspaces
npm install

# 2. Start PostgreSQL + Redis only
docker compose up -d postgres redis

# 3. Copy env, run migrations, start both services
cp apps/api/.env.example apps/api/.env
cd apps/api && npm run migration:run && cd ../..
npm run dev:api   # http://localhost:3000  |  Swagger: http://localhost:3000/docs
npm run dev:web   # http://localhost:5173
```

Register an account → create a project → add environments → create flags → configure strategies.

---

## Database Migrations

Schema changes are managed with TypeORM migrations. `synchronize: true` is disabled — the schema is never auto-modified at runtime.

```bash
# Apply all pending migrations
cd apps/api && npm run migration:run

# Undo last migration
cd apps/api && npm run migration:revert

# Show migration status
cd apps/api && npm run migration:show

# Generate a new migration after editing an entity
cd apps/api && npm run migration:generate -- src/migrations/MyChange
```

See [apps/api/README.md](apps/api/README.md#database-migrations) for the full migration guide including the upgrade path from `synchronize: true`.

---

