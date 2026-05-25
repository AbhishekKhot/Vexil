# @vexil/sdk-js

JavaScript / TypeScript SDK for the Vexil feature flag service. Polls the API, caches flags in memory, hands your app synchronous typed reads.

```bash
npm install @vexil/sdk-js
```

Node 18+ or any modern browser.

---

## Quick start

```ts
import { VexilClient } from "@vexil/sdk-js";

const client = new VexilClient({
  apiKey: "vex_...",                  // from dashboard → Environments
  baseUrl: "http://localhost:3000",   // your Vexil API
});

await client.init({ userId: "user-123", country: "US" });

if (client.isEnabled("new-checkout")) renderNewCheckout();

const theme = client.getValue<string>("ui-theme", "light");

await client.destroy();   // on app shutdown
```

`init()` fetches all flags once and starts a background poll (every 30 s by default). Reads (`isEnabled`, `getValue`) are synchronous and served from the local cache.

---

## API

### `new VexilClient(options)`

| Option | Default | Notes |
|---|---|---|
| `apiKey` | required | Environment API key (`vex_…`) |
| `baseUrl` | required | API URL, no trailing slash |
| `pollingInterval` | `30000` | ms between background re-fetches |
| `onFlagsUpdated(flags)` | — | called after each successful poll |
| `onError(err)` | — | called on network / API errors |

### Methods

```ts
await client.init(context?)        // fetch flags + start polling
await client.identify(context)     // replace context, immediately re-fetch
client.isEnabled(key, default?)    // boolean shortcut (default: false)
client.getValue<T>(key, default)   // typed value with fallback
client.getFlag(key)                // FlagResult | undefined
client.getAllFlags()               // shallow copy of the whole cache
await client.destroy()             // stop polling
```

### Context

Every key you pass is forwarded as-is to the API for rule evaluation:

```ts
await client.init({
  userId: "u_42",     // used for rollout bucketing + user targeting
  country: "US",      // used by attribute / targeted-rollout rules
  plan: "pro",        // any custom key works
  betaTester: true,
});
```

### FlagResult

```ts
interface FlagResult {
  value: boolean | string | number | object;
  type: "boolean" | "string" | "number" | "json";
  variant?: string;   // set by A/B test strategy
  reason: string;     // see table below
}
```

### Reason codes

| Reason | Meaning |
|---|---|
| `BOOLEAN` | Boolean strategy — fixed value |
| `ROLLOUT_IN` / `ROLLOUT_OUT` | Inside / outside the rollout percentage |
| `USER_WHITELIST` / `USER_FALLTHROUGH` | User-targeting result |
| `ATTRIBUTE_MATCH` / `ATTRIBUTE_NO_MATCH` | Rule match result |
| `AB_VARIANT` | Variant assigned by A/B test |
| `TIME_WINDOW_ACTIVE` / `TIME_WINDOW_INACTIVE` | Inside / outside the time window |
| `PREREQUISITE_MET` / `PREREQUISITE_NOT_MET` | Prerequisite check |
| `FLAG_DISABLED` | Flag is off — default value returned |
| `FLAG_NOT_FOUND` | Key isn't in the response |

---

## React example

```tsx
import { VexilClient } from "@vexil/sdk-js";
import { createContext, useContext, useEffect, useRef, useState } from "react";

const FlagCtx = createContext<VexilClient | null>(null);

export function FlagProvider({ children, user }) {
  const ref = useRef<VexilClient | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    ref.current = new VexilClient({
      apiKey: import.meta.env.VITE_VEXIL_API_KEY,
      baseUrl: import.meta.env.VITE_API_URL,
    });
    ref.current.init({ userId: user.id }).then(() => setReady(true));
    return () => { ref.current?.destroy(); };
  }, [user.id]);

  if (!ready) return null;
  return <FlagCtx.Provider value={ref.current}>{children}</FlagCtx.Provider>;
}

export const useFlag = (key: string, fallback = false) =>
  useContext(FlagCtx)?.isEnabled(key) ?? fallback;
```

---

## Build from source

```bash
cd packages/sdk-js
npm run build    # CJS + ESM + .d.ts in dist/
npm run dev      # watch mode
```
