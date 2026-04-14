# @vexil/web

React 19 admin dashboard for the Vexil feature flag platform. Lets teams manage projects, environments, flags, strategies, segments, and view analytics/audit logs.

Built with: React 19 · React Router v7 · Vite 6 · Tailwind CSS 3.4 · TypeScript 5.6

---

## Prerequisites

- Node.js >= 18
- npm >= 9
- The API (`apps/api`) must be running — the dashboard is a thin client over the REST API

---

## Setup

### 1. Install dependencies

```bash
# From monorepo root (installs all workspaces)
npm install
```

### 2. Configure environment

Create `apps/web/.env` (or `apps/web/.env.local`):

```bash
VITE_API_URL=http://localhost:3000
```

In production, set this to your deployed API URL (e.g. `https://vexil-api.up.railway.app`).

> The Vite dev server proxies `/api` and `/v1` to `VITE_API_URL` automatically — no CORS issues in development.

### 3. Run

```bash
# From monorepo root
npm run dev:web

# Or from this directory
npm run dev
```

Dashboard available at `http://localhost:5173`.

---

## Usage Guide

### 1. Register & Login

Navigate to `http://localhost:5173/register` to create the first account. This also creates an **Organisation** — all projects and users are scoped to it.

Subsequent team members can register and will join the same organisation (assuming you invite them — currently handled by sharing the register URL; org join logic is managed server-side).

### 2. Create a Project

From the **Projects** dashboard, click **New Project**. A project groups a set of feature flags and their environments.

### 3. Add Environments

Inside a project, go to the **Environments** tab. Create environments such as `development`, `staging`, `production`. Each environment gets a unique API key (`vex_…`) used by the SDK.

> Copy the API key from the **Environments** tab — it is shown once on creation and can be rotated.

### 4. Create Flags

Go to the **Flags** tab. Click **New Flag** and choose a key (e.g. `new-checkout`), a display name, and a type (`boolean`, `string`, `number`, or `json`).

### 5. Configure a Strategy

Click **Configure** on a flag to open the strategy builder. Select an environment and choose a strategy:

| Strategy | What it does |
|----------|-------------|
| Boolean | Returns a fixed value — simplest on/off toggle |
| Rollout | Deterministic percentage rollout (djb2 hash of userId + flagKey) |
| User Targeting | Allow/deny specific user IDs; optionally fallthrough to others |
| Attribute Matching | Rule-based targeting on any context attribute (eq, in, contains, gt, lt, …) |
| Targeted Rollout | Attribute rules AND percentage rollout combined |
| A/B Test | Weighted variant assignment across multiple variants |
| Time Window | Automatically enables/disables between two UTC timestamps |
| Prerequisite | Gated on another flag resolving to an expected value (max 3 levels deep) |

You can also set a **Scheduled Change** — a future strategy config that auto-applies at a given time (processed by the SchedulerService every 60s).

### 6. Build Segments

Under the **Segments** tab, create reusable rule sets (e.g. "EU users", "premium plan"). Segments can be referenced when configuring attribute-based strategies.

### 7. Analytics

The **Analytics** tab shows evaluation counts and pass rates per flag and environment over time. Data is collected via the SDK's analytics buffer and flushed to the API every 30s or 1000 events.

### 8. Audit Log

The **Audit Logs** tab is a paginated, immutable record of every create/update/delete action in the project, including who made the change and what the full payload was.

---

## Roles & Permissions

| Action | ADMIN | MEMBER | VIEWER |
|--------|:-----:|:------:|:------:|
| View all resources | ✓ | ✓ | ✓ |
| Create / update | ✓ | ✓ | — |
| Delete | ✓ | — | — |

Roles are assigned at the organisation level. The first registered user is ADMIN.

---

## Production Build

```bash
# From this directory or monorepo root
npm run build          # tsc + vite build → dist/
npm run preview        # Serve dist/ locally for a smoke-test
```

The `dist/` folder is a static SPA. Serve it with any static host (Nginx, Vercel, Railway static, etc.).

**Nginx snippet** (for client-side routing):
```nginx
location / {
    root /usr/share/nginx/html;
    try_files $uri $uri/ /index.html;
}
```

The included `Dockerfile` uses a multi-stage build (Node build → Nginx Alpine serve).

---

## Project Structure

```
apps/web/src/
├── main.tsx                # React entry point, router setup
├── api/
│   └── client.ts           # HTTP wrapper — injects JWT on every request
├── contexts/
│   ├── AuthContext.tsx      # JWT token + user state, logout
│   └── ThemeContext.tsx     # Light / dark mode toggle
├── components/
│   ├── GlobalLayout.tsx     # Shell with sidebar navigation
│   ├── RequireAuth.tsx      # Route guard — redirects to /login if no token
│   └── ...                 # Shared UI components
└── pages/
    ├── LoginPage.tsx
    ├── RegisterPage.tsx
    ├── ProjectsDashboard.tsx
    ├── ProjectDetail.tsx    # Wrapper with nested tab routing
    ├── FlagsTab.tsx
    ├── EnvironmentsTab.tsx
    ├── SegmentsTab.tsx
    ├── AnalyticsTab.tsx
    ├── AuditLogTab.tsx
    └── FlagConfigurePage.tsx  # Strategy builder
```

---

## Environment Variables

| Variable | Description |
|----------|-------------|
| `VITE_API_URL` | Base URL of the Vexil API. Injected at **build time** by Vite. |

> Because `VITE_API_URL` is baked in at build time, you need a separate build artifact per deployment target (or use runtime injection via a `/config.json` endpoint — not yet implemented).
