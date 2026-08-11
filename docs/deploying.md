# Deploying

Three files, three jobs. The split exists so a deployment problem can be
reproduced on a laptop instead of debugged through a host's log viewer.

| File | Runs | Source |
|---|---|---|
| `docker-compose.yml` | development — vite dev server, api, postgres | bind-mounted, hot reload |
| `Dockerfile` | the production image | copied in, then gone |
| `docker-compose.prod.yml` | that image, locally, against a local postgres | none |

```bash
docker compose up                                    # develop
docker compose -f docker-compose.prod.yml up --build # rehearse the deployment
```

Development is on `:5173` (web) and `:5001` (api). Production is one process on
`:8080`.

## What only exists in production

This is the list worth knowing, because every item is something that cannot
break in development and therefore cannot be found there.

**One process serves both halves.** In development vite serves the UI and
proxies `/api` to the api container. In production there is no vite and no
proxy — Express serves the built files itself, guarded by `STATIC_DIR`. Unset
that variable and the same image is API-only, which is what makes it reusable
behind a CDN later.

**Client-side routes are the server's problem.** A refresh on `/goals` is a
request the server has never heard of. Anything not under `/api` and not a real
file returns `index.html`. Registered after the API router, so an unknown API
path still 404s as an API path rather than quietly handing HTML to a `fetch`.

**Asset paths are fixed at build time.** `BASE_PATH=/` is baked into the image.
A wrong value produces a blank page with 404s in the console, and no amount of
runtime configuration fixes it.

**Nothing is mounted.** The source is not in the runtime image, so nothing is
editable in place — which is the point, and also why a broken image has to be
rebuilt rather than poked.

**Schema push runs on boot.** The entrypoint runs `drizzle-kit push` before
serving, and says so loudly if `DATABASE_URL` is missing. A container that
comes up with no tables answers every request with a 500 that looks like an
application fault.

## The vite config, and why it changed

`vite.config.ts` validated `PORT` when the config loaded, which made
`vite build` fail with "PORT environment variable is required" — a dev-server
concern on a path that never starts a server. It is resolved lazily now and
still required wherever a server is actually started. The config became an
async function to keep the plugins' top-level `await` valid.

That defect was invisible for as long as there was no production build. It is
the clearest argument for keeping a production path that runs locally.

## Deploying it somewhere

The image is one container that needs one environment variable to be useful:

| Variable | |
|---|---|
| `DATABASE_URL` | required — Postgres connection string |
| `JWT_SECRET` | required in production — a long random token-signing secret, held only in the host's secret store |
| `PORT` | usually injected by the host; defaults to 8080 |
| `GROQ_API_KEY` | optional. Without it, suggestions fall back to keyword matching and say so on screen |
| `STATIC_DIR` | set by the image; unset it to serve the API alone |

Never bake `JWT_SECRET` or `GROQ_API_KEY` into the image or commit either one
— use the host's secret mechanism. Generate the JWT value with, for example,
`openssl rand -base64 48`. The app deliberately refuses to start in production
without it; its development fallback is public source code, not a credential.
`.env` is gitignored.

### Free hosting that cuts off rather than bills

For a demo, the question worth asking of any host is not "is there a free
tier" but "what happens at the limit". Two different answers:

- **Stops**: Render's free web services, Koyeb's free tier, Hugging Face
  Spaces, Neon and Supabase for the database. No card, and exceeding the limit
  suspends rather than charges.
- **Bills**: Google Cloud Run, Fly.io, Railway, AWS free tier. All require a
  billing account, and overage is charged — budget alerts notify, they do not
  stop.

Render plus Neon is the straightforward pairing here: one container, one
Postgres, neither able to generate an invoice. The free web service sleeps
after fifteen minutes idle, so the first request after a pause takes about
half a minute — fine for a demo, worth knowing before a live one.

Free tiers change often, and some of the above have changed inside the last
year. Check two things at signup: whether a card is required, and whether the
limit suspends or charges.
