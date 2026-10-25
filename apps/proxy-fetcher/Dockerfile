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
FROM base AS fetch
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY .npmrc* ./
# Downloads the packages of the whole lockfile into the store: the layer depends on the lockfile
# only. pnpm has verified the lockfile when it wrote it; --trust-lockfile skips verifying it again,
# which would request the metadata of every package from the registry.
RUN --mount=type=cache,id=pnpm-store,target=/pnpm-store \
    --mount=type=cache,id=pnpm-metadata,target=/root/.cache/pnpm \
    pnpm --trust-lockfile fetch --frozen-lockfile

################################
# Installation
################################
FROM fetch AS install
COPY . .
# Links the app and the workspace packages it depends on from the store, without the registry.
RUN --mount=type=cache,id=pnpm-store,target=/pnpm-store \
    --mount=type=cache,id=pnpm-metadata,target=/root/.cache/pnpm \
    pnpm --trust-lockfile install --offline --frozen-lockfile --filter proxy-fetcher...

################################
# Build
################################
FROM install AS build
# The trailing "..." builds the workspace packages the app depends on first.
RUN pnpm --filter proxy-fetcher... build
RUN --mount=type=cache,id=pnpm-store,target=/pnpm-store \
    --mount=type=cache,id=pnpm-metadata,target=/root/.cache/pnpm \
    pnpm --trust-lockfile --offline --filter proxy-fetcher deploy --prod /deploy

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
