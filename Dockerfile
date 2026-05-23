# Runtime image for a pre-built Nuxt (node-server preset) bundle.
# Build the app on the host first:
#   bun install
#   bun run build:node
# Then:
#   docker build -t forza-data .

FROM node:22-slim

WORKDIR /app

COPY .output ./
COPY docker/migrate.mjs /app/server/migrate.mjs

# NuxtHub bakes the build-host's absolute path into the bundle as a string
# literal (not runtime-overridable). Rewrite it to a stable in-container path.
RUN mkdir -p /app/data/db \
 && sed -i -E \
      -e 's|"file:[^"]*/\.data/db/sqlite\.db"|"file:/app/data/db/sqlite.db"|g' \
      -e 's|"[^"]*/\.data"|"/app/data"|g' \
      -e 's|"[^"]*/server/db/migrations"|"/app/server/db/migrations"|g' \
      server/node_modules/@nuxthub/db/db.mjs \
      server/chunks/nitro/nitro.mjs

ENV NODE_ENV=production \
    NITRO_PORT=3000 \
    NITRO_HOST=0.0.0.0 \
    FORZA_PORT=5300 \
    FORZA_BIND=0.0.0.0

EXPOSE 3000
EXPOSE 5300/udp

CMD ["sh", "-c", "node /app/server/migrate.mjs && exec node /app/server/index.mjs"]
