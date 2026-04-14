# @vexil/sdk-js

JavaScript / TypeScript SDK for the Vexil feature flag platform.

Features: polling evaluation · in-memory flag cache · analytics buffering · typed API · zero runtime dependencies (beyond `@vexil/types`)

---

## Installation

```bash
npm install @vexil/sdk-js
```

Requires Node.js >= 18 or a modern browser environment.

---

## Quick Start

```typescript
import { VexilClient } from "@vexil/sdk-js";

const client = new VexilClient({
  apiKey: "vex_...",                      // Environment API key — Dashboard → Environments
  baseUrl: "https://api.example.com",     // Your deployed API URL
  pollingInterval: 30_000,               // Re-fetch flags every 30s (default)
  onFlagsUpdated: (flags) => console.log("flags refreshed", flags),
  onError: (err) => console.error("vexil error", err),
});

// Fetch flags for a user — call once at startup / after login
await client.init({ userId: "u_42", country: "US", plan: "pro" });

// Zero-latency reads from in-memory cache
if (client.isEnabled("new-checkout")) {
  renderNewCheckout();
}

const theme  = client.getValue<string>("ui-theme", "light");   // typed with fallback
const limit  = client.getValue<number>("rate-limit", 100);

// Switch user context (e.g. on login)
await client.identify({ userId: "u_99", plan: "free" });

// Graceful shutdown — flushes buffered analytics, stops polling timer
await client.destroy();
```

---

## API Reference

### `new VexilClient(options)`

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `apiKey` | `string` | **required** | Environment API key (`vex_…`) from the dashboard |
| `baseUrl` | `string` | **required** | Base URL of the Vexil API (no trailing slash) |
| `pollingInterval` | `number` | `30000` | Milliseconds between flag re-fetches |
| `onFlagsUpdated` | `(flags: FlagMap) => void` | — | Called each time flags are refreshed by the poller |
| `onError` | `(err: Error) => void` | — | Called on network errors or API failures |

---

### `client.init(context)`

Fetches all flags for the given user context, populates the in-memory cache, and starts the polling timer.

```typescript
await client.init({
  userId: "u_42",       // used for rollout bucketing + user targeting
  country: "US",        // available for attribute-matching rules
  plan: "pro",          // custom attribute
  betaTester: true,     // custom attribute — any key is forwarded
});
```

Returns a `FlagMap` (`Record<string, FlagResult>`). Subsequent reads are served from cache.

---

### `client.isEnabled(flagKey, defaultValue?)`

Returns `true` if the flag is enabled for the current context, `false` otherwise. Returns `defaultValue` (default `false`) if the flag is not in the cache.

```typescript
if (client.isEnabled("dark-mode")) { ... }
```

---

### `client.getValue<T>(flagKey, defaultValue)`

Returns the typed flag value. Use `defaultValue` as the fallback when the flag is missing or disabled.

```typescript
const theme = client.getValue<string>("ui-theme", "light");
const limit = client.getValue<number>("rate-limit", 100);
const config = client.getValue<{ max: number }>("feature-config", { max: 50 });
```

---

### `client.identify(context)`

Updates the user context and immediately re-fetches flags. Use after login, plan upgrade, or any attribute change.

```typescript
await client.identify({ userId: "u_99", plan: "enterprise" });
```

---

### `client.getFlags()`

Returns the current in-memory `FlagMap` without triggering a network request.

```typescript
const flags = client.getFlags();
console.log(flags["new-checkout"]?.value); // true | false | string | number | object
```

---

### `client.destroy()`

Stops the polling timer and flushes any buffered analytics events. Call this on app shutdown or when unmounting a React root.

```typescript
await client.destroy();
```

---

## EvaluationContext

Any key you pass to `init()` or `identify()` is forwarded to the API as-is. The API uses these attributes for rule evaluation.

Reserved keys with special meaning:

| Key | Used for |
|-----|---------|
| `userId` | Rollout bucketing (djb2 hash), user-targeting whitelist |

All other keys are available for attribute-matching rules configured in the dashboard.

---

## Analytics

The SDK automatically buffers analytics events and flushes them to `POST /v1/events` when either:
- 30 seconds have elapsed since the last flush, **or**
- 1000 events have accumulated

Events record which flags were evaluated and their results. PII fields are stripped server-side before storage.

---

## FlagResult shape

```typescript
interface FlagResult {
  value: boolean | string | number | object;
  type: "boolean" | "string" | "number" | "json";
  variant?: string;    // populated for A/B test strategies
  reason: string;      // e.g. BOOLEAN, ROLLOUT_IN, ROLLOUT_OUT, USER_WHITELIST, AB_VARIANT, …
}
```

---

## React Example

```tsx
import { VexilClient } from "@vexil/sdk-js";
import { createContext, useContext, useEffect, useRef, useState } from "react";

const FlagContext = createContext<VexilClient | null>(null);

export function FlagProvider({ children, user }: { children: React.ReactNode; user: User }) {
  const clientRef = useRef<VexilClient | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const client = new VexilClient({
      apiKey: import.meta.env.VITE_VEXIL_API_KEY,
      baseUrl: import.meta.env.VITE_API_URL,
    });
    clientRef.current = client;

    client.init({ userId: user.id, plan: user.plan }).then(() => setReady(true));

    return () => { client.destroy(); };
  }, [user.id]);

  if (!ready) return null;
  return <FlagContext.Provider value={clientRef.current}>{children}</FlagContext.Provider>;
}

export function useFlag(key: string, defaultValue = false) {
  const client = useContext(FlagContext);
  return client?.isEnabled(key) ?? defaultValue;
}
```

---

## Building from source

```bash
cd packages/sdk-js

# One-off build (CJS + ESM + type declarations)
npm run build

# Watch mode for local development
npm run dev
```

Output in `dist/`:
- `dist/index.js` — CommonJS
- `dist/index.mjs` — ESM
- `dist/index.d.ts` — TypeScript declarations

---

## Strategy Reason Codes

| Reason | Meaning |
|--------|---------|
| `BOOLEAN` | Boolean strategy — fixed value |
| `ROLLOUT_IN` | User fell inside the rollout percentage |
| `ROLLOUT_OUT` | User fell outside the rollout percentage |
| `USER_WHITELIST` | userId matched the whitelist |
| `USER_FALLTHROUGH` | userId not in whitelist, fallthrough value returned |
| `ATTRIBUTE_MATCH` | All attribute rules passed |
| `ATTRIBUTE_NO_MATCH` | One or more attribute rules failed |
| `AB_VARIANT` | Variant assigned by A/B test weights |
| `TIME_WINDOW_ACTIVE` | Current time is within the configured window |
| `TIME_WINDOW_INACTIVE` | Current time is outside the configured window |
| `PREREQUISITE_MET` | Prerequisite flag resolved to expected value |
| `PREREQUISITE_NOT_MET` | Prerequisite flag did not resolve to expected value |
| `FLAG_DISABLED` | Flag is disabled — default value returned |
| `FLAG_NOT_FOUND` | Flag key not in evaluation response |
