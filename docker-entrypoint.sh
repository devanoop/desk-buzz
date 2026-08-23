#!/bin/sh
# Runs on every container start, on every host (Railway/Render/Fly/plain
# Docker) — there's no separate "release phase" concept portable across all
# three, so this is where migrations + the sample-data seed happen instead.
# Both are safe to re-run: drizzle-kit tracks applied migrations, and
# `npm run ingest`'s default seed mode is idempotent (see
# src/modules/ingestion/ingest.ts).
set -e

echo "[docker-entrypoint] running migrations..."
npm run db:migrate

echo "[docker-entrypoint] seeding sample salary data (idempotent)..."
npm run ingest

echo "[docker-entrypoint] starting server..."
exec npm run start
