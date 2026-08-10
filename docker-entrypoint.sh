#!/bin/sh
set -e

# Push the schema before serving.
#
# Deliberately not silent on failure. A container that comes up with no tables
# answers every request with a 500 that looks like an application fault; the
# database being unreachable is a different problem and should say so here,
# once, rather than in every request log afterwards.
if [ -n "$DATABASE_URL" ]; then
  echo "→ pushing schema"
  cd /app/db && ./node_modules/.bin/drizzle-kit push --config ./drizzle.config.ts
  cd /app
else
  echo "!! DATABASE_URL is not set — starting anyway, but every route that reads data will fail"
fi

echo "→ starting on :${PORT:-8080}"
exec node --enable-source-maps /app/dist/index.mjs
