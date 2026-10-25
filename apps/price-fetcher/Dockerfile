# Build context is the monorepo root: docker compose build (see docker-compose.yml)
ARG NODE_VERSION=26
ARG APP_NAME=price-fetcher

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
ARG APP_NAME
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY .npmrc* ./
COPY apps/${APP_NAME}/package.json ./apps/${APP_NAME}/package.json
# Manifests of the workspace packages the app depends on (needed for a frozen install).
COPY packages/logger/package.json ./packages/logger/package.json
COPY packages/product-reference/package.json ./packages/product-reference/package.json
COPY packages/proxy-endpoint/package.json ./packages/proxy-endpoint/package.json
COPY packages/queue-contract/package.json ./packages/queue-contract/package.json
RUN --mount=type=cache,id=pnpm-store,target=/pnpm-store \
    pnpm install --frozen-lockfile

################################
# Build
################################
FROM deps AS build
ARG APP_NAME
COPY . .
# The trailing "..." builds the workspace packages the app depends on first.
RUN pnpm --filter ${APP_NAME}... build && \
    pnpm --filter ${APP_NAME} deploy --legacy --prod /deploy

################################
# Development
################################
FROM deps AS dev
ARG APP_NAME
ENV NODE_ENV=development \
    CI=true \
    APP_NAME=${APP_NAME}
RUN apt-get update && \
    apt-get install -y --no-install-recommends xvfb xauth && \
    rm -rf /var/lib/apt/lists/*
RUN pnpm --filter ${APP_NAME} exec playwright install --with-deps chromium
ENTRYPOINT ["xvfb-run", "-a"]
CMD ["sh", "-c", "pnpm --filter $APP_NAME dev:worker"]

################################
# Production
################################
FROM base AS prod
WORKDIR /app
ENV NODE_ENV=production \
    PLAYWRIGHT_BROWSERS_PATH=/opt/playwright
COPY --from=build /deploy/node_modules ./node_modules
COPY --from=build /deploy/dist ./dist
COPY --from=build /deploy/package.json ./package.json
RUN apt-get update && \
    apt-get install -y --no-install-recommends xvfb xauth && \
    rm -rf /var/lib/apt/lists/*
RUN node node_modules/playwright/cli.js install --with-deps chromium && chmod -R a+rX /opt/playwright
USER node
ENTRYPOINT ["xvfb-run", "-a"]
CMD ["node", "dist/worker.js"]
