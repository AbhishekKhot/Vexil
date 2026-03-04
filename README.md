# 🚩 Vexil

> **Vexil** (Latin: _Vexillum_) — A high-performance, developer-first, self-hosted feature flag and remote configuration service.

Vexil is designed to decouple code deployments from feature releases. It enables engineering teams to perform percentage rollouts, user segmentation, and instant kill-switches across multiple environments without redeploying applications.

---

## 🏗️ High-Level Design (HLD)

Vexil is split into the **Control Plane** (Management) and the **Data Plane** (High-speed Delivery).

```mermaid
graph TD
    subgraph "External Consumer (Client App)"
        SDK[Vexil SDK - Node/Java/Go/Ruby/Elixir]
    end

    subgraph "Vexil Control Plane (Management)"
        Dash[Next.js Admin Dashboard]
        AdminAPI[Fastify Management API]
    end

    subgraph "Vexil Data Plane (Delivery)"
        EvalAPI[Edge API - SDK Polling]
        PubSub[Redis Pub/Sub - Realtime Updates]
    end

    subgraph "Persistence & Messaging"
        PG[(PostgreSQL - Source of Truth)]
        Cache[(Redis - High Speed Ruleset)]
        MQ[RabbitMQ - Analytics & Workers]
    end

    %% Flow
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
