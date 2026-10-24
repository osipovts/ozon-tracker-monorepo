# Build context is the monorepo root: docker compose build (see docker-compose.yml)
ARG NODE_VERSION=26

################################
# Base
################################
FROM node:${NODE_VERSION}-slim AS base
WORKDIR /app
ENV PNPM_STORE_PATH="/pnpm-store"
# The Prisma schema engine that applies the migrations needs OpenSSL.
RUN apt-get update && \
    apt-get install -y --no-install-recommends openssl && \
    rm -rf /var/lib/apt/lists/*
# Install the pnpm version pinned in package.json "packageManager" (without the "+sha..." suffix)
RUN --mount=type=bind,source=package.json,target=/tmp/package.json \
    npm install -g "$(node -p "require('/tmp/package.json').packageManager.split('+')[0]")" && \
    pnpm config set store-dir "$PNPM_STORE_PATH"

################################
# Dependencies
################################
FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY .npmrc* ./
COPY apps/hub/package.json ./apps/hub/package.json
# Manifests of the workspace packages the app depends on (needed for a frozen install).
COPY packages/logger/package.json ./packages/logger/package.json
COPY packages/product-reference/package.json ./packages/product-reference/package.json
COPY packages/queue-contract/package.json ./packages/queue-contract/package.json
RUN --mount=type=cache,id=pnpm-store,target=/pnpm-store \
    pnpm install --frozen-lockfile

################################
# Build
################################
FROM deps AS build
COPY . .
# The trailing "..." builds the workspace packages first; the hub build generates the Prisma client.
RUN pnpm --filter hub... build && \
    pnpm --filter hub deploy --legacy --prod /deploy

################################
# Production
################################
FROM base AS prod
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /deploy/node_modules ./node_modules
COPY --from=build /deploy/dist ./dist
COPY --from=build /deploy/prisma ./prisma
COPY --from=build /deploy/prisma.config.js ./prisma.config.js
COPY --from=build /deploy/package.json ./package.json
USER node
EXPOSE 3000
# Applies the pending migrations, then starts the API.
CMD ["sh", "-c", "node node_modules/prisma/build/index.js migrate deploy && exec node dist/index.js"]
