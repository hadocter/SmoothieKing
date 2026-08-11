# Running locally with Docker

Brings up Postgres, the API and the web app with no local Node, pnpm or
Postgres install. This sits alongside the Replit setup and does not replace
it — nothing in `.replit` references these files.

```bash
cp .env.example .env      # fill in GROQ_API_KEY if you want the LLM paths
docker compose up
```

| | |
|---|---|
| web | http://localhost:5173 |
| api | http://localhost:5001 (health: `/api/healthz`) |
| db  | `postgres://postgres:dev@localhost:55432/smoothieking` |

The API container runs `db push` before starting, so the schema and seed data
are in place on first boot.

## Things that are not obvious

**The API is on host port 5001, not 5000.** macOS binds 5000 for AirPlay
Receiver by default. The container still listens on 5000 and the web app
proxies to `api:5000` over the compose network, so only direct access from
the host moved.

**pnpm is pinned to 9.15.9 inside Compose.** It matches the lockfile format,
and the workspace explicitly allows the required `esbuild` build script. The
one-shot `install` service runs before the API and web services, so they never
race to write the same `node_modules` tree.

**The install uses `--no-frozen-lockfile`.** Docker Compose needs a
non-interactive install (`CI=true`) and the command is kept explicit in the
service definition. Check `git status` after a local setup; dependency changes
should be intentional and reviewed, never a side effect of starting a stack.

**pnpm writes its store into the repo.** With the tree bind-mounted, pnpm
puts `.pnpm-store/` next to the code — tens of thousands of files. It is
gitignored now; it was not, and the first commit attempt swept the whole
thing in.

Both of these are symptoms of the same thing: the lockfile and the workspace
config have drifted apart. Refreshing the lockfile on the repo's own terms
would fix both and let this file drop the two workarounds.

## Secrets

`GROQ_API_KEY` is read from the environment or `.env`, never baked into an
image or committed. `.env` is gitignored — note that it was not before, since
`.gitignore` had no rule for it at all.

## Useful

```bash
docker compose logs -f api
docker compose exec db psql -U postgres -d smoothieking
docker compose run --rm install sh -c "corepack enable && corepack prepare pnpm@9.15.9 --activate && pnpm run typecheck"
docker compose down -v     # also drops the database volume
```
