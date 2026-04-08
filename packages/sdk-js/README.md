# Vexil JavaScript / TypeScript SDK

Lightweight SDK for evaluating feature flags from a Vexil server. Supports automatic analytics buffering, background polling, and typed flag values.

## Requirements

Node.js ≥ 18

## Installation

```bash
npm install @vexil/sdk-js
```

## Quick Start

```typescript
import { VexilClient } from "@vexil/sdk-js";

const client = new VexilClient({
  apiKey: "vex_...",           // environment API key from the Vexil dashboard
  baseUrl: "http://localhost:3000",
});

// Fetch flags — pass user/request attributes as context
await client.fetchFlags({ userId: "user_88", country: "IN", tier: "premium" });

// Boolean kill-switch
if (client.isEnabled("new-dashboard")) {
  renderNewDashboard();
}

// Typed string / number / JSON value
const theme = client.getValue<string>("ui-theme");   // e.g. "dark"
const limit = client.getValue<number>("rate-limit"); // e.g. 100

// Full evaluation details (value, type, variant, reason)
const details = client.getDetails("ui-theme");

// Flush analytics and clear timers before app shutdown
await client.destroy();
```

## Configuration

```typescript
new VexilClient({
  apiKey: string;           // Required. Environment API key (format: vex_...)
  baseUrl: string;          // Required. Vexil server URL
  pollingInterval?: number; // Optional. Auto-refresh interval in ms (default: 0 = disabled)
})
```

## API Reference

### `fetchFlags(context?)`

Fetches all flag evaluations for the given user context from `POST /v1/eval`. Automatically buffers evaluation events for analytics.

```typescript
await client.fetchFlags({
  userId: "user_88",
  country: "IN",
  tier: "premium",
  // any custom attributes your flag rules reference
});
```

Returns `FlagMap` — a map of `flagKey → { value, type, variant, reason }`.

---

### `isEnabled(key)`

Returns `true` if the flag exists and its evaluated value is `true`. Safe to call before `fetchFlags` (returns `false`).

```typescript
client.isEnabled("new-header"); // boolean
```

---

### `getValue<T>(key)`

Returns the evaluated flag value cast to type `T`, or `null` if the flag is not found.

```typescript
client.getValue<string>("ui-theme");  // string | null
client.getValue<number>("max-items"); // number | null
client.getValue<object>("config");    // object | null
```

---

### `getDetails(key)`

Returns the full `FlagResult` for a flag, or `null`.

```typescript
interface FlagResult {
  value: any;
  type: "boolean" | "string" | "number" | "json";
  variant?: string;
  reason?: string; // e.g. "ROLLOUT", "USER_TARGETING", "DEFAULT"
}
```

---

### `pollingInterval` — background refresh

Pass `pollingInterval` (milliseconds) to automatically re-fetch flags in the background using the last context.

```typescript
const client = new VexilClient({
  apiKey: "vex_...",
  baseUrl: "http://localhost:3000",
  pollingInterval: 60_000, // refresh every 60 seconds
});

// Stop polling manually
client.stopPolling();
```

---

### Analytics — automatic event buffering

Every `fetchFlags()` call automatically buffers evaluation events. Events are sent to `POST /v1/events` in batches:

- Every **30 seconds** (flush interval)
- OR when the buffer reaches **1,000 events**

No manual tracking is required. You can also flush manually:

```typescript
await client.flush();
```

Or use the legacy manual method for one-off sends:

```typescript
await client.trackEvents([
  { flagKey: "new-header", result: true, context: { userId: "user_88" } },
]);
```

---

### `destroy()`

Stops all background timers and flushes any remaining analytics events. Call before process exit or in SSR cleanup.

```typescript
await client.destroy();
```

---

## Evaluation Context

Pass any user attributes relevant to your flag targeting rules:

```typescript
await client.fetchFlags({
  userId: "user_88",    // used for user_targeting and rollout hashing
  country: "IN",        // custom attribute for attribute_matching / segments
  tier: "premium",      // custom attribute
  plan: "enterprise",   // custom attribute
});
```

The SDK sends this context to the server, which evaluates all flags using your configured strategies (rollout, user targeting, A/B test, time window, etc.) and returns the results.

## Strategy Types

| Strategy | Description |
|---|---|
| `boolean` | Simple kill switch — on or off |
| `rollout` | Percentage-based rollout (djb2 hash, deterministic) |
| `targeted_rollout` | Segment match + percentage rollout |
| `user_targeting` | Explicit user ID whitelist |
| `attribute_matching` | All attribute rules must pass (AND logic) |
| `ab_test` | Weighted variants |
| `time_window` | Active between UTC start and end times |
| `prerequisite` | Another flag's value must equal an expected value |
