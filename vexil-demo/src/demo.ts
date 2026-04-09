/**
 * Vexil SDK Demo
 *
 * Evaluates all configured flag strategies end-to-end using the live API.
 *
 * Prerequisites:
 *   1. Vexil API running (npm run dev inside Vexil/apps/api)
 *   2. Create a project + environment in the UI
 *   3. Copy .env.example → .env and fill in VEXIL_API_KEY
 *   4. Create flags in the UI matching the keys below (see SETUP section)
 *
 * Run: npm run demo
 */

import 'dotenv/config';
import { VexilClient, EvaluationContext } from '@vexil/sdk-js';

const API_KEY = process.env.VEXIL_API_KEY ?? '';
const BASE_URL = process.env.VEXIL_BASE_URL ?? 'http://localhost:3000';

if (!API_KEY) {
  console.error('❌  VEXIL_API_KEY is not set. Copy .env.example → .env and set it.');
  process.exit(1);
}

// ---------------------------------------------------------------------------
// FLAG KEYS — must match exactly what you created in the Vexil UI
// ---------------------------------------------------------------------------
const FLAGS = {
  boolean:           'boolean-test-flag',
  rollout:           'rollout-test-flag',
  userTargeting:     'user-targeting-test-flag',
  abTest:            'ab-test-flag',
};

// ---------------------------------------------------------------------------
// SETUP GUIDE — how to configure each flag in the UI
// ---------------------------------------------------------------------------
// Flag key                  | Strategy        | Config
// --------------------------|-----------------|------------------------------------
// boolean-test-flag         | Boolean         | value: true
// rollout-test-flag         | Rollout         | percentage: 50
// user-targeting-test-flag  | User Targeting  | userIds: ["alice"], fallthrough: false
// ab-test-flag              | A/B Test        | variants: control(false,50%) + treatment(true,50%)
// ---------------------------------------------------------------------------

async function runDemo() {
  console.log('='.repeat(60));
  console.log('  Vexil SDK Demo — all strategy types');
  console.log('='.repeat(60));
  console.log(`  API:  ${BASE_URL}`);
  console.log(`  Key:  ${API_KEY.slice(0, 12)}…`);
  console.log('');

  // ----- Context 1: Pro user from the US, known userId -----
  const proUser: EvaluationContext = {
    userId: 'alice',
    identifier: 'alice',
    attributes: {
      plan: 'pro',
      country: 'US',
      role: 'admin',
    },
  };

  // ----- Context 2: Free user from DE -----
  const freeUser: EvaluationContext = {
    userId: 'charlie',
    identifier: 'charlie',
    attributes: {
      plan: 'free',
      country: 'DE',
      role: 'viewer',
    },
  };

  const client = new VexilClient({
    apiKey: API_KEY,
    baseUrl: BASE_URL,
    pollingInterval: 60_000,
    onError: (err) => console.error('  [SDK error]', err.message),
  });

  // ── Evaluate as pro user (alice) ─────────────────────────────────────────
  console.log('👤  Context: pro user (alice, plan=pro, country=US)');
  console.log('-'.repeat(60));
  await client.init(proUser);
  printFlags(client.getAllFlags());

  // ── Evaluate as free user (charlie) ─────────────────────────────────────
  console.log('');
  console.log('👤  Context: free user (charlie, plan=free, country=DE)');
  console.log('-'.repeat(60));
  await client.identify(freeUser);
  printFlags(client.getAllFlags());

  // ── isEnabled() convenience checks ──────────────────────────────────────
  console.log('');
  console.log('🔍  isEnabled() checks (charlie context):');
  console.log(`  ${FLAGS.boolean.padEnd(32)} → ${client.isEnabled(FLAGS.boolean)}`);
  console.log(`  ${FLAGS.rollout.padEnd(32)} → ${client.isEnabled(FLAGS.rollout)}`);
  console.log(`  ${FLAGS.userTargeting.padEnd(32)} → ${client.isEnabled(FLAGS.userTargeting)}`);

  // ── A/B test variant detail ──────────────────────────────────────────────
  const abResult = client.getFlag(FLAGS.abTest);
  if (abResult) {
    console.log('');
    console.log(`🔀  A/B test result for charlie:`);
    console.log(`  variant = ${abResult.variant ?? 'none'}`);
    console.log(`  value   = ${abResult.value}`);
    console.log(`  reason  = ${abResult.reason}`);
  }

  // ── Flush events ─────────────────────────────────────────────────────────
  await client.destroy();
  console.log('');
  console.log('✅  Demo complete. Events flushed.');
  console.log('='.repeat(60));
}

function printFlags(flags: Record<string, { value: unknown; reason: string; variant?: string }>) {
  const entries = Object.entries(flags);
  if (entries.length === 0) {
    console.log('  (no flags found — check your environment API key and flag configs)');
    return;
  }
  for (const [key, result] of entries) {
    const val = JSON.stringify(result.value);
    const variant = result.variant ? ` [variant: ${result.variant}]` : '';
    const icon = result.value ? '✓' : '✗';
    console.log(`  ${icon}  ${key.padEnd(32)} value=${val}${variant}  (${result.reason})`);
  }
}

runDemo().catch((err) => {
  console.error('Fatal:', err.message);
  process.exit(1);
});
