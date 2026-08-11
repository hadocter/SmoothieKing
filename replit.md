# Smoothy King workspace notes

Smoothy King is a goal-aware smoothie planner. Start with the root
[README](README.md) for the product overview, local Docker run instructions,
Render + Neon deployment guide, AI collaboration disclosure, and Demo Day
materials.

## Useful commands

- `pnpm run typecheck` — typecheck the workspace.
- `pnpm run build` — typecheck and build the application packages.
- `pnpm --filter @workspace/db run push` — apply the schema to the configured
  development database.
- `pnpm --filter @workspace/api-server run dev` — run the API (requires
  `DATABASE_URL`).

## Project map

- `artifacts/smoothy-king/` — React/Vite frontend.
- `artifacts/api-server/` — Express API and deterministic recommendation logic.
- `lib/db/` — Drizzle schema and seed catalog.
- `docs/` — product rules, deployment, AI disclosure, and Demo Day runbook.

Do not place credentials in source control. Production requires `DATABASE_URL`
and a non-empty `JWT_SECRET`; see [.env.example](.env.example) and the root
README for details.
