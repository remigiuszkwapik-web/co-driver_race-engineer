# Multi-stage build so each target architecture installs its own
# libsql native binding. Build args / buildx pick the platform.
#
# Single-arch local build:
#   docker build -t co-driver .
#
# Multi-arch publish (see README):
#   docker buildx build --platform linux/amd64,linux/arm64 \
#     -t <dockerhub-user>/co-driver:latest --push .

# Stage 1 — install + build the Nuxt bundle inside the container so the
# bundled @libsql native binding matches the target arch.
FROM oven/bun:1 AS build

WORKDIR /src

COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

COPY . .
RUN NITRO_PRESET=node-server bun run build

# Bun's bundler can drop transitive deps that resolve via conditional exports
# at build time but are needed at runtime (e.g. ws via @libsql/isomorphic-ws's
# node entrypoint). Backfill from the build stage's full node_modules.
RUN cp -r node_modules/ws .output/server/node_modules/ws

# NuxtHub bakes the absolute project path into the bundle as a string
# literal. Rewrite it to the stable in-container path the runtime uses.
RUN sed -i -E \
      -e 's|"file:[^"]*/\.data/db/sqlite\.db"|"file:/app/data/db/sqlite.db"|g' \
      -e 's|"[^"]*/\.data"|"/app/data"|g' \
      -e 's|"[^"]*/server/db/migrations"|"/app/server/db/migrations"|g' \
      .output/server/node_modules/@nuxthub/db/db.mjs \
      .output/server/chunks/nitro/nitro.mjs

# Stage 2 — thin runtime image. Only the .output bundle + migration runner.
FROM node:22-slim

WORKDIR /app

COPY --from=build /src/.output ./
COPY docker/migrate.mjs /app/server/migrate.mjs

ENV NODE_ENV=production \
    NITRO_PORT=3000 \
    NITRO_HOST=0.0.0.0 \
    FORZA_PORT=5300 \
    FORZA_BIND=0.0.0.0

EXPOSE 3000
EXPOSE 5300/udp

# /app/data/db is created at runtime — a build-time mkdir gets shadowed by
# any bind-mount or named volume on /app/data, leaving libsql with no
# parent dir to open. Doing it in CMD survives every mount strategy.
CMD ["sh", "-c", "mkdir -p /app/data/db && node /app/server/migrate.mjs && exec node /app/server/index.mjs"]
