# Production image: one container, both halves of the app.
#
# Development runs three services with the source bind-mounted — see
# docker-compose.yml. This is the opposite: nothing is mounted, the source is
# gone by the last stage, and what ships is a bundle plus static files.
#
# One container rather than two because free hosting tiers hand out one
# service, and because the two halves have nothing to say to each other over a
# network once vite's dev proxy is out of the picture — Express serves the
# built UI directly.

# ---------------------------------------------------------------- build
FROM node:24-alpine AS build

# pnpm 9, matching the lockfile's version. Newer pnpm reads `allowBuilds` in
# pnpm-workspace.yaml in preference to `onlyBuiltDependencies`, and that key
# holds an unfilled placeholder — see docs/local-docker.md.
RUN corepack enable && corepack prepare pnpm@9.15.9 --activate

WORKDIR /app

# Manifests first, so a source-only change does not re-resolve the whole tree.
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json ./
COPY lib/api-client-react/package.json  lib/api-client-react/
COPY lib/api-spec/package.json          lib/api-spec/
COPY lib/api-zod/package.json           lib/api-zod/
COPY lib/db/package.json                lib/db/
COPY artifacts/api-server/package.json  artifacts/api-server/
COPY artifacts/smoothy-king/package.json artifacts/smoothy-king/
COPY scripts/package.json               scripts/

# --no-frozen-lockfile because the lockfile's recorded `overrides` disagree
# with pnpm-workspace.yaml. Pre-existing; the workaround is documented rather
# than hidden.
ENV CI=true
RUN pnpm install --no-frozen-lockfile

COPY . .

# The web app needs a base path at build time and is served from the root here.
ENV BASE_PATH=/
RUN pnpm --filter @workspace/smoothy-king run build \
 && pnpm --filter @workspace/api-server  run build

# Only what the server actually needs at runtime. `--prod` drops the build
# toolchain; drizzle-kit is kept because the container runs `db push` on boot.
RUN pnpm --filter @workspace/api-server --prod deploy /out \
 && pnpm --filter @workspace/db                 deploy /out-db

# ---------------------------------------------------------------- runtime
FROM node:24-alpine AS runtime

RUN corepack enable && corepack prepare pnpm@9.15.9 --activate
WORKDIR /app

# Not root. Nothing here needs to write to the image.
RUN addgroup -S app && adduser -S app -G app

COPY --from=build --chown=app:app /out                                   ./
COPY --from=build --chown=app:app /app/artifacts/api-server/dist         ./dist
COPY --from=build --chown=app:app /app/artifacts/smoothy-king/dist/public ./public

# The db package, deployed *with* its dev dependencies — drizzle-kit is one of
# them and the container pushes the schema on boot. Deployed rather than copied
# so the schema sources and the tool travel together and the config's relative
# `./src/schema/index.ts` still resolves.
COPY --from=build --chown=app:app /out-db ./db

USER app

ENV NODE_ENV=production
# JWT_SECRET is deliberately not set here: it is a per-deployment secret.
# auth.ts rejects this production process if the host has not injected it.
# Set, so app.ts turns on static serving. Absent, the server is API-only —
# which is what makes the same bundle usable behind a separate CDN later.
ENV STATIC_DIR=/app/public
# Hosts inject their own PORT; this is only the fallback.
ENV PORT=8080
EXPOSE 8080

COPY --chown=app:app docker-entrypoint.sh /app/entrypoint.sh
ENTRYPOINT ["/app/entrypoint.sh"]
