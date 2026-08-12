# Smoothy King

**A goal-aware smoothie builder for busy people who have a nutrition goal or constraint but do not know what smoothie to make. It turns a short preference check into a safe, repeatable drink plan and a weekly ingredient list.**

[Repository](https://github.com/hadocter/SmoothieKing) · [Deploy guide](#deploy-to-render--neon) · [Demo script](docs/demo-day.md) · [5-minute demo deck](presentation/Smoothy-King-Demo-Day.pptx) · [Demo Day materials](presentation/) · [Architecture notes](docs/README.md)

> **Live URL:** create the Render service below, then paste its `https://…onrender.com` URL here before submitting. We deliberately do not invent a deployment URL or user count.

## What a first-time user can do

1. Create an account and describe a goal in everyday language.
2. Confirm the suggested goal, dietary needs, allergies, dislikes, and available time.
3. Get a set of buildable smoothies whose ingredient selection is checked by deterministic code.
4. Choose one, see its steps and nutrition, log it after making it, and plan the week’s shopping list.
5. Mark unavailable ingredients, choose a substitution or skip it, and rebuild within the same safety constraints.

The core promise is deliberately narrow: **you do not need to know what to make, but the app will not pretend a plausible-looking recipe is safe or goal-fit without checking it.**

## What makes the recommendation trustworthy

- **Code chooses the ingredients.** Required slots (including liquid and protein), quantities, nutrition totals, goal-fit scoring, and allergen/diet exclusions are deterministic and covered by tests.
- **Safety fails closed.** If an allergen profile or a required recipe slot cannot be satisfied, that drink is discarded instead of being presented as a smaller or “close enough” smoothie.
- **AI has a limited role.** An optional Groq model can map natural language onto the app’s controlled choices and write a drink name/story. It never selects ingredients, decides allergy safety, or invents nutrition. If it is unavailable, the app uses a visible keyword-matching fallback.
- **The plan connects to the kitchen.** The weekly shelf turns generated drinks into a practical list, tracks what is on hand, and offers safe substitutions.

Read the product’s deterministic rules in [docs/smoothie-building.md](docs/smoothie-building.md) and the failure modes in [docs/allergen-check.md](docs/allergen-check.md).

## Honest limits

This is a demo-stage planning product, not medical advice. It does **not** predict whether a smoothie will taste good, handle medication/pregnancy interactions, know local prices or stock, or support households. A blender is currently assumed. These are intentional boundaries, not hidden claims; see [docs/demo-day.md](docs/demo-day.md) for the Demo Day Q&A answers and [the project dossier](docs/README.md) for design notes.

## Run locally

### Fastest route: Docker

Prerequisite: [Docker Desktop](https://www.docker.com/products/docker-desktop/).

```bash
git clone https://github.com/hadocter/SmoothieKing.git
cd SmoothieKing
cp .env.example .env
docker compose up --build
```

Open <http://localhost:5173>. The API is available at <http://localhost:5001/api/healthz>. The first startup creates the schema and seeds the catalog automatically.

`GROQ_API_KEY` is optional for local work. Leave it empty to use the built-in keyword fallback. In development, the JWT secret has a local-only fallback; do not use that configuration in production.

Useful commands:

```bash
docker compose logs -f api
docker compose down                  # stop containers and preserve local data
docker compose down -v               # stop containers and remove the local database
pnpm run typecheck                   # TypeScript checks across the workspace
pnpm run build                       # production builds for all packages
```

For native development and troubleshooting, see [docs/local-docker.md](docs/local-docker.md).

## Deploy to Render + Neon

The repository includes [render.yaml](render.yaml), so deployment is repeatable and does not require copying build commands from this README. Render builds the root [Dockerfile](Dockerfile), which serves the compiled React application and Express API from **one container**.

### 1. Create the Postgres database

1. Create a Neon project and database.
2. In Neon, choose **Connect** and copy the pooled Postgres connection string. Keep it private; it contains a password.
3. Verify the string contains `sslmode=require` (Neon requires TLS).

### 2. Create the web service

1. Push this repository to GitHub and make it public if the course requires a public repository.
2. In Render, choose **New → Blueprint**, select the repository, and approve `render.yaml`.
3. When Render prompts for `DATABASE_URL`, paste the Neon connection string.
4. Render generates `JWT_SECRET` automatically. Do not replace it with the development fallback or commit a secret to Git.
5. Leave `GROQ_API_KEY` empty unless you want natural-language mapping and generated drink names. The product remains usable without it.
6. Create the Blueprint and wait for the deploy log to reach **Live**. Render assigns the public `https://<service>.onrender.com` address.

The Blueprint configures `/api/healthz` as the health check. The container applies the Drizzle schema on startup and seeds the catalog; the service is ready only after the health check succeeds.

### 3. Smoke-test the deployed service

Run these checks before putting the URL in the course submission:

```bash
curl -i https://YOUR-SERVICE.onrender.com/api/healthz
```

Then open the URL in an incognito/private window and complete this stranger test:

- Sign up with a new email and finish onboarding.
- Set an allergy or dietary restriction and confirm it does not appear in a generated drink.
- Build a smoothie, open its steps, log it, and add it to the weekly plan.
- Mark one planned ingredient “Not this week,” choose a substitute or skip it, and confirm the plan updates.
- Refresh `/goals` and `/this-week`; both should load as application routes rather than return a server 404.

### Production environment variables

| Variable | Required | Purpose |
| --- | :---: | --- |
| `DATABASE_URL` | Yes | Neon/Postgres connection string, including TLS settings. |
| `JWT_SECRET` | Yes | Random secret used to sign sessions. Render generates it in the Blueprint. |
| `PORT` | Host | Render supplies a port. The image defaults to `8080`. |
| `GROQ_API_KEY` | No | Enables optional natural-language matching and naming. |
| `GROQ_MODEL` | No | Defaults to `llama-3.3-70b-versatile`. |
| `LLM_PROVIDER` | No | Defaults to `groq`; set `mock` for a fully offline fallback. |

Never commit `.env`, database URLs, API keys, or JWT secrets. The server refuses to start in production if `JWT_SECRET` is missing.

### Roll back safely

- **Code:** use Render’s deploy history to redeploy a previously healthy commit, or revert the Git commit and push again.
- **Database:** this app runs schema push on boot. Review schema changes before deploying and take a Neon branch/backup before destructive migrations.
- **Local rehearsal:** run `JWT_SECRET="$(openssl rand -base64 48)" docker compose -f docker-compose.prod.yml up --build` and open <http://localhost:8080> before publishing a major change.

More deployment details and the production/runtime differences are in [docs/deploying.md](docs/deploying.md). Render’s Blueprint documentation and Neon’s connection-string guide are linked there as the source of truth because hosting plans and dashboards change.

## Demo Day: a focused live run

The live demo should show one complete loop, not every screen:

1. Sign in to the prepared demo account. Do not spend live-demo time on sign-up.
2. Choose a concrete goal and an allergy/diet constraint.
3. Generate a smoothie, point out the safety/goal-fit facts and recipe steps.
4. Log the drink and open **This week** to show the actionable ingredient plan.
5. Mark an ingredient unavailable, select a safe substitute, and show the rebuilt plan.

Use [docs/demo-day.md](docs/demo-day.md) for the presenter run-of-show, direct Q&A answers, and the slide deck location.
The submission-ready deck, interactive presentation reference, emergency video,
and concise five-minute flow are bundled in [presentation/](presentation/).

## How the team used AI to build it (honest disclosure)

We used AI coding assistants to explore implementation options, draft and refactor code/copy, propose tests, and support UI/UX review. The AI-assisted photo workflow initially selected visually mismatched ingredient images (including a red drink for cold green tea), so we replaced the reviewed image manually and changed the photo-publishing script to require explicit visual approval before it updates the catalog.

We wrote and reviewed the acceptance tests and deterministic guardrails for required liquid/protein slots, fail-closed allergy checks, and invalid request handling because plausible-looking model output is not sufficient evidence that a drink is safe or buildable. Humans set the product scope, inspected every accepted change, ran the application and tests, and made the final decisions. No API keys or user data were supplied to the assistants.

The product’s in-app AI boundary is intentionally tighter than its development use: AI can translate language and write optional presentation copy; deterministic code controls ingredients, safety checks, and nutrition. The full disclosure is in [docs/ai-collaboration.md](docs/ai-collaboration.md).

## Repository map

| Path | Purpose |
| --- | --- |
| `artifacts/smoothy-king/` | React/Vite web application. |
| `artifacts/api-server/` | Express API, safety, generation, plans, community, and authentication. |
| `lib/db/` | PostgreSQL/Drizzle schema and seed data. |
| `lib/api-*` | API contract, Zod validation, and generated client helpers. |
| `docs/` | Product rules, deployment notes, AI disclosure, and Demo Day materials. |
| `presentation/` | Demo Day deck, interactive presentation reference, backup video, and five-minute flow. |
| `Dockerfile`, `render.yaml` | Production container and repeatable Render deployment configuration. |

## Verification

At the final handoff, the project passed the workspace typecheck, production API build, production web build, and **186 automated tests** covering the deterministic domain logic. See the individual documents in [docs/](docs/README.md) for the reasoning behind the safety, scoring, and nutrition decisions.

## License

MIT. Ingredient photography in `artifacts/smoothy-king/public/food/` is sourced from Unsplash under the [Unsplash License](https://unsplash.com/license).
