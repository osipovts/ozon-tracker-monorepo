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
RUN --mount=type=cache,id=pnpm-store,target=/pnpm-store \
    pnpm install --frozen-lockfile

################################
# Build
################################
FROM deps AS build
COPY . .
RUN pnpm build && \
    pnpm prune --prod

################################
# Development
################################
FROM base AS dev
ENV NODE_ENV=development \
    CI=true
CMD ["pnpm", "dev"]

################################
# Production
################################
FROM gcr.io/distroless/nodejs${NODE_VERSION}-debian13:nonroot AS prod
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/package.json ./package.json
CMD ["dist/index.js"]