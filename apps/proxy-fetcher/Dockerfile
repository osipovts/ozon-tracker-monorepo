# Build context is the monorepo root: docker compose build (see docker-compose.yml)
ARG NODE_VERSION=26

################################
# Base
################################
FROM node:${NODE_VERSION}-slim AS base
WORKDIR /app
ENV PNPM_STORE_PATH="/pnpm-store"
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
COPY apps/proxy-fetcher/package.json ./apps/proxy-fetcher/package.json
# Manifests of the workspace packages the app depends on (needed for a frozen install).
COPY packages/logger/package.json ./packages/logger/package.json
COPY packages/proxy-endpoint/package.json ./packages/proxy-endpoint/package.json
COPY packages/queue-contract/package.json ./packages/queue-contract/package.json
RUN --mount=type=cache,id=pnpm-store,target=/pnpm-store \
    pnpm install --frozen-lockfile

################################
# Build
################################
FROM deps AS build
COPY . .
# The trailing "..." builds the workspace packages the app depends on first.
RUN pnpm --filter proxy-fetcher... build && \
    pnpm --filter proxy-fetcher deploy --legacy --prod /deploy

################################
# Production
################################
FROM node:${NODE_VERSION}-slim AS prod
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /deploy/node_modules ./node_modules
COPY --from=build /deploy/dist ./dist
COPY --from=build /deploy/package.json ./package.json
USER node
CMD ["node", "dist/index.js"]
