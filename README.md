# 🚩 Vexil

> **Vexil** — A high-performance, open-source feature flag and remote configuration service with local evaluation and deterministic rollouts.

---

## 🚀 Getting Started

### Prerequisites

- **Node.js** ≥ 18
- **Docker** (for Postgres, Redis, RabbitMQ)
- **npm** ≥ 9

### 1. Clone and install dependencies

```bash
git clone https://github.com/your-org/vexil.git
cd vexil
npm install          # installs all workspace packages
```

### 2. Start infrastructure

```bash
docker compose up -d
```

This starts:
- PostgreSQL on port **5433**
- Redis on port **6379**
- RabbitMQ on ports **5672** (AMQP) and **15672** (management UI, guest/guest)

### 3. Configure the backend

```bash
cd services/admin-api
cp .env.example .env   # then edit as needed
```

| Variable | Default | Description |
|---|---|---|
| `PORT` | `3000` | Fastify listen port |
| `DB_HOST` | `127.0.0.1` | PostgreSQL host |
| `DB_PORT` | `5433` | PostgreSQL port |
| `DB_USER` | `postgres` | PostgreSQL username |
| `DB_PASS` | `postgres` | PostgreSQL password |
| `DB_NAME` | `vexil` | PostgreSQL database name |
| `REDIS_HOST` | `127.0.0.1` | Redis host |
| `REDIS_PORT` | `6379` | Redis port |
| `RABBITMQ_URL` | `amqp://guest:guest@127.0.0.1:5672` | RabbitMQ connection (optional — analytics queue) |
| `JWT_SECRET` | `vexil-dev-secret-change-in-prod` | JWT signing secret — **change in production** |
| `NODE_ENV` | `development` | Set to `test` to use in-memory Redis mock |

### 4. Start the backend

```bash
cd services/admin-api
npm run dev          # ts-node, port 3000
```

The API is now available at `http://localhost:3000`.
Interactive API docs (Swagger UI) are at **`http://localhost:3000/docs`**.

### 5. Start the frontend

```bash
cd services/admin-ui
npm run dev          # Vite dev server, port 5173
```

Open **`http://localhost:5173`** — register an account, create a project, and start managing flags.

---

## 📦 SDK Quick Start

### TypeScript / Node.js

```bash
npm install @vexil/sdk-js
```

```typescript
import { VexilClient } from "@vexil/sdk-js";

const client = new VexilClient({
  apiKey: "vex_...",           // environment API key from the dashboard
  baseUrl: "http://localhost:3000",
  pollingInterval: 60_000,     // optional: refresh flags every 60s
});

// Fetch flags with a user context
await client.fetchFlags({ userId: "user_88", country: "IN", tier: "premium" });

// Check boolean flags
if (client.isEnabled("new-dashboard")) {
  renderNewDashboard();
}

// Read typed values
const theme = client.getValue<string>("ui-theme");      // string
const limit = client.getValue<number>("rate-limit");    // number

// Stop background processes before shutdown
await client.destroy();
```

**Analytics** are captured automatically on every `fetchFlags()` call and flushed to `/v1/events` every 30 seconds (or when 1,000 events accumulate).

### Ruby

```bash
# No gem required — just copy lib/vexil.rb into your project
```

```ruby
require_relative "lib/vexil"

client = Vexil::Client.new(
  api_key: "vex_...",
  base_url: "http://localhost:3000"
)

client.fetch_flags(userId: "user_88", country: "IN", tier: "premium")

if client.enabled?("new-dashboard")
  render_new_dashboard
end

theme = client.value("ui-theme", "light")
```

---

## ✨ Key Highlights

- 🚀 **Sub-millisecond Latency**: Rules are processed locally in the SDK, avoiding network round-trips for every flag check.
- ⚖️ **Deterministic Rollouts**: Consistent hashing for "sticky" percentage-based traffic splitting.
- 🌍 **Environment Isolation**: Native support for Development, Staging, and Production with unique API keys.
- 🎯 **Advanced Targeting**: Segment users by region, subscription tier, or custom metadata.
- 🛠️ **Enterprise Tech Stack**: Powered by **Fastify**, **Node.js**, **PostgreSQL**, **Redis**, and **RabbitMQ**.
- 📦 **Multi-SDK Support**: TypeScript/Node.js and Ruby SDKs included.

---

# 🏗️ High-Level Design (HLD)

Vexil is split into the **Control Plane** (Management) and the **Data Plane** (High-speed Delivery).

```mermaid
graph TD
    subgraph "External Consumer (Client App)"
        SDK[Vexil SDK]
    end

    subgraph "Vexil Control Plane"
        Dash[React Admin Dashboard]
        AdminAPI[Fastify Management API]
    end

    subgraph "Vexil Data Plane"
        EvalAPI[Edge API - SDK Polling]
        PubSub[Redis Pub/Sub - Realtime Updates]
    end

    subgraph "Persistence & Messaging"
        PG[(PostgreSQL - Source of Truth)]
        Cache[(Redis - High Speed Ruleset)]
        MQ[RabbitMQ - Analytics & Workers]
    end

    Dash --> AdminAPI
    AdminAPI --> PG
    AdminAPI --> Cache
    AdminAPI --> PubSub

    SDK -- "1. Fetch Ruleset" --> EvalAPI
    EvalAPI -- "Reads Cache" --> Cache
    PubSub -- "Invalidates" --> EvalAPI

    SDK -- "2. Background Analytics" --> MQ
    MQ --> PG
```

---

# 📦 SDK Integration

## General Workflow

1. **Initialize**: Provide your Environment API Key.
2. **Context**: Pass a JSON object containing user attributes (ID, location, etc.).
3. **Check**: Call the variation method to evaluate the flag locally.

---

## 🟢 TypeScript / Node.js

```typescript
import { VexilClient } from "@vexil/sdk-js";

const client = new VexilClient({
  apiKey: "vex_dev_key_123",
  baseUrl: "http://localhost:3000",
});

const userContext = { userId: "user_88", country: "IN", tier: "premium" };

await client.fetchFlags(userContext);

if (client.isEnabled("beta_feature")) {
  renderNewDashboard();
} else {
  renderOldDashboard();
}

const theme = client.getValue<string>("ui-theme");
```

---

## 🔴 Ruby

```ruby
require_relative "lib/vexil"

client = Vexil::Client.new(
  api_key: "vex_dev_key_123",
  base_url: "http://localhost:3000"
)

user_context = { userId: "user_88", country: "IN", tier: "premium" }
client.fetch_flags(user_context)

if client.enabled?("beta_feature")
  # Show new UI
end

theme = client.value("ui-theme", "light")
```

---


# 1️⃣ Local Evaluation Sequence Diagram

Internal lifecycle of a `getVariation` call within the SDK.  
It **never leaves the application process**.

```mermaid
sequenceDiagram
    participant App as Client Application
    participant SDK as Vexil SDK Engine
    participant Store as In-Memory Rule Store
    participant Tracker as Event Buffer (Analytics)

    App->>SDK: getVariation("new_header", userContext)
    SDK->>Store: Get rules for "new_header"

    alt Flag Not Found or Disabled
        Store-->>SDK: return null / disabled
        SDK-->>App: return defaultValue
    else Flag Enabled
        SDK->>SDK: 1. Check Targeted User IDs (Overrides)
        alt User ID Matches
            SDK-->>App: return specific variant
        else No ID Match
            SDK->>SDK: 2. Evaluate Segments (Attributes)
            alt Segment Match (e.g., Country == 'IN')
                SDK-->>App: return segment variant
            else No Segment Match
                SDK->>SDK: 3. Calculate Deterministic Hash
                Note right of SDK: Hash(UserID + Salt) % 100
                alt Hash < Rollout %
                    SDK-->>App: return rollout variant
                else
                    SDK-->>App: return defaultValue
                end
            end
        end
    end

    SDK->>Tracker: Log "Evaluation Event" (Async)
    Note over Tracker: Pushed to RabbitMQ in background batch
```

---

# 2️⃣ Rule Engine Logic (LLD)

---

## A. Hashing Algorithm (Consistent Selection)

We use **djb2** for deterministic bucket assignment:
- Fast, no dependencies
- Even distribution across 100 buckets
- Same `(userId + flagKey)` always maps to the same bucket

### Logic

1. Take the `userId` (or configured `hashAttribute`) from context.
2. Append the **flag key** as a salt to prevent correlated rollouts.
3. Run djb2 hash.
4. Apply modulo 100 → bucket 0–99.

```typescript
function computeBucket(identifier: string, seed: string): number {
  const str = `${identifier}:${seed}`;
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash) ^ str.charCodeAt(i);
  }
  return Math.abs(hash >>> 0) % 100;
}
```

---

## B. Segment Matching (Predicate Engine)

Supported operators:

- `eq` — Equals  
- `neq` — Not Equals  
- `gt` — Greater Than  
- `lt` — Less Than  
- `in` — In Array  
- `nin` — Not In Array  
- `regex` — Regular Expression Match  

---

# 3️⃣ Monitoring & Event Capture (Analytics)

**Does not** sends an HTTP request for every flag evaluation.

## LLD Strategy

### In-Memory Buffer

The SDK maintains:

```
Map<FlagKey, Counter>
```

---

### Debounced Flush (JS SDK)

- Every **30 seconds**
- OR when buffer reaches **1000 events**

SDK sends one batch request:

```
POST /v1/events
```

---

### Ingestion Pipeline

1. Data Plane API receives batch
2. Drops payload into **RabbitMQ**
3. Worker consumes messages
4. Worker increments usage counters in PostgreSQL

---

# 4️⃣ Entity Relationship (ER) Diagram

```mermaid
erDiagram
    ORGANIZATION ||--o{ PROJECT : owns
    PROJECT ||--o{ ENVIRONMENT : has
    PROJECT ||--o{ FLAG : defines
    
    ENVIRONMENT ||--o{ API_KEY : authenticated_by
    
    FLAG ||--o{ FLAG_CONFIG : has_state_in
    ENVIRONMENT ||--o{ FLAG_CONFIG : contains
    
    FLAG_CONFIG {
        boolean is_enabled
        jsonb rules
        jsonb variants
        timestamp scheduled_at
    }

    PROJECT ||--o{ SEGMENT : defines
    SEGMENT {
        string name
        jsonb conditions
    }
```

---

# 🎯 Summary

Vexil provides:

- ⚡ Local, zero-latency flag evaluation  
- 🎯 Deterministic and consistent rollouts  
- 🧠 Advanced targeting with segment engine  
- 📊 Efficient batched analytics  
- 🏗️ Scalable control & data plane separation  

---

**Vexil = Performance + Determinism + Developer Experience**