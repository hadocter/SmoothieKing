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

**pnpm is pinned to 9.15.9.** `pnpm-lock.yaml` is lockfileVersion 9.0 and the
repo has no `packageManager` field, so corepack would otherwise install the
latest. On pnpm 11 the install fails outright:

```
[ERR_PNPM_IGNORED_BUILDS] Ignored build scripts: esbuild@0.27.3
```

The cause is in `pnpm-workspace.yaml`:

```yaml
allowBuilds:
  esbuild: set this to true or false
```

That is an unfilled placeholder. Newer pnpm reads `allowBuilds` in preference
to `onlyBuiltDependencies`, and a string that is not a boolean denies the
build. Worth filling in — but it lives in a block with a supply-chain warning
on it, so it is the repo's call rather than something the compose file should
work around by editing.

**The install runs with `--no-frozen-lockfile`.** `CI=true` (needed so pnpm
does not prompt for a TTY that compose does not have) implies a frozen
install, and the committed lockfile's recorded `overrides` do not match
`pnpm-workspace.yaml`:

```
ERR_PNPM_LOCKFILE_CONFIG_MISMATCH  the current "overrides" configuration
doesn't match the value found in the lockfile
```

Also pre-existing. The side effect is that **installing rewrites
`pnpm-lock.yaml`** — about 3,300 lines changed on the first run here. That is
pnpm reformatting, not a dependency change, and it should not be committed
from a local dev run:

```bash
git checkout pnpm-lock.yaml
```

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
