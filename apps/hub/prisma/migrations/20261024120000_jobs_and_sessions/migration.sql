-- CreateTable
CREATE TABLE "jobs" (
    "id" UUID NOT NULL,
    "kind" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "percent" INTEGER NOT NULL DEFAULT 0,
    "processed" INTEGER NOT NULL DEFAULT 0,
    "total" INTEGER,
    "succeeded" INTEGER NOT NULL DEFAULT 0,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "startedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "browser_sessions" (
    "id" UUID NOT NULL,
    "marketplace" TEXT NOT NULL,
    "proxyServer" TEXT,
    "routeKey" TEXT NOT NULL,
    "exitIp" TEXT NOT NULL,
    "userAgent" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "browserVersion" TEXT NOT NULL,
    "storageState" JSONB NOT NULL,
    "status" TEXT NOT NULL,
    "staleReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "lastUsedAt" TIMESTAMP(3),

    CONSTRAINT "browser_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "jobs_createdAt_idx" ON "jobs"("createdAt" DESC);

-- CreateIndex
CREATE INDEX "jobs_kind_status_idx" ON "jobs"("kind", "status");

-- CreateIndex
CREATE UNIQUE INDEX "browser_sessions_marketplace_routeKey_key" ON "browser_sessions"("marketplace", "routeKey");

