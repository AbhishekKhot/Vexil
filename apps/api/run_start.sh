#!/bin/sh
# ---------------------------------------------------------------------------
# run_start.sh — production entrypoint for the Vexil API container.
#
# Execution order:
#   1. Run pending database migrations (idempotent — safe to run on every boot)
#   2. Hand off to the Node.js server process
#
# Used by:
#   - apps/api/Dockerfile  (CMD)
#   - docker-compose.yml   (api service command)
#   - npm run start:migrate (local convenience alias)
#
# The migration step uses the compiled data-source.js so no ts-node or
# TypeScript tooling is required in the production image.
# ---------------------------------------------------------------------------
set -e

echo "[startup] ── Vexil API ─────────────────────────────────────────"
echo "[startup] Running database migrations..."

node -e "
const { AppDataSource } = require('./dist/data-source');

AppDataSource.initialize()
  .then(function(ds) {
    return ds.runMigrations({ transaction: 'all' });
  })
  .then(function(ran) {
    if (ran.length === 0) {
      console.log('[startup] No pending migrations — schema is up to date.');
    } else {
      ran.forEach(function(m) {
        console.log('[startup] Applied migration: ' + m.name);
      });
    }
    return AppDataSource.destroy();
  })
  .then(function() {
    process.exit(0);
  })
  .catch(function(err) {
    console.error('[startup] Migration failed:', err.message);
    process.exit(1);
  });
"

echo "[startup] Migrations complete."
echo "[startup] Starting Vexil API server..."
echo "[startup] ─────────────────────────────────────────────────────"

exec node dist/server.js
