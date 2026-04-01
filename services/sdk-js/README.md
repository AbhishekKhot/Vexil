# Vexil JavaScript/TypeScript SDK

A lightweight SDK for evaluating feature flags in Vexil.

## Installation

```bash
npm install @vexil/sdk-js
```

## Usage

```typescript
import { createVexilClient } from '@vexil/sdk-js';

// 1. Initialize the client
const vexil = createVexilClient({
  apiKey: 'vex_your_api_key',
  baseUrl: 'http://localhost:3000'
});

// 2. Fetch flags (supports targeting context)
await vexil.fetchFlags({
  userId: '123',
  country: 'US',
  plan: 'premium'
});

// 3. Check flags
if (vexil.isEnabled('new-header')) {
  console.log('User has the new header!');
}

// Get rich values
const theme = vexil.getValue('theme-color'); // 'blue'
```

## Analytics

Vexil automatically tracks evaluations if you use `trackEvents`.

```typescript
await vexil.trackEvents([
  { flagKey: 'new-header', result: true, context: { userId: '123' } }
]);
```
