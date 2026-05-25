# @vexil/web

React 19 + Vite + Tailwind dashboard for Vexil. A thin client over the REST API — no business logic lives here.

---

## Run it locally

The API (`apps/api`) must already be running on `http://localhost:3000`.

```bash
# From the repo root
npm install
npm run dev:web
```

Dashboard at http://localhost:5173.

Point at a different API:

```bash
echo "VITE_API_URL=http://your-api-host:3000" > apps/web/.env
```

> `VITE_API_URL` is baked into the JS bundle at build time. Set it before `npm run build` for each deployment target.

---

## Walkthrough

1. **Register** at `/register`. This creates an organisation and makes you ADMIN.
2. **Create a project** to group flags + environments.
3. **Environments tab** — add `development`, `staging`, `production`, etc. Each one gets its own API key (`vex_…`) for the SDK. Copy it when shown.
4. **Flags tab → New Flag** — pick a key (e.g. `new-checkout`), name, and type (`boolean` / `string` / `number` / `json`).
5. **Configure** a strategy per environment:

| Strategy | What it does |
|---|---|
| Boolean | Fixed on/off |
| Rollout | % of users, stable per user |
| User Targeting | Allow/deny by user ID |
| Attribute Matching | Rules on context attributes (`eq`, `in`, `contains`, `gt`, `lt`, …) |
| Targeted Rollout | Attribute rules + % |
| A/B Test | Weighted variants |
| Time Window | Auto-toggle between two UTC timestamps |
| Prerequisite | Gated on another flag |

   You can also set a **Scheduled Change** — a future strategy that auto-applies (a background job promotes it every 60 s).

6. **Segments tab** — save reusable rule sets that strategies can reference.
7. **Audit Logs tab** — immutable record of every create / update / delete in the project.

---

## Roles

| Action | ADMIN | MEMBER | VIEWER |
|---|:-:|:-:|:-:|
| View | ✓ | ✓ | ✓ |
| Create / update | ✓ | ✓ | — |
| Delete | ✓ | — | — |

First registered user becomes ADMIN.

---

## Build

```bash
npm run build      # → dist/  (static SPA)
npm run preview    # smoke-test the build
```

The included `Dockerfile` uses an nginx-Alpine final stage. For other static hosts, configure SPA fallback to `index.html`.
