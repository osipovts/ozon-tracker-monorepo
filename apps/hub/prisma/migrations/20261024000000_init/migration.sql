-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "proxies" (
    "server" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "country" TEXT,
    "exitIp" TEXT,
    "alive" BOOLEAN NOT NULL,
    "latencyMs" INTEGER,
    "checksTotal" INTEGER NOT NULL DEFAULT 0,
    "checksAlive" INTEGER NOT NULL DEFAULT 0,
    "successRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "lastCheckedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "proxies_pkey" PRIMARY KEY ("server")
);

-- CreateTable
CREATE TABLE "tracked_products" (
    "id" UUID NOT NULL,
    "marketplace" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "lastStatus" TEXT,
    "lastCheckedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tracked_products_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "price_observations" (
    "id" UUID NOT NULL,
    "trackedProductId" UUID NOT NULL,
    "jobId" UUID NOT NULL,
    "status" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "observedAt" TIMESTAMP(3) NOT NULL,
    "availability" TEXT NOT NULL,
    "quantity" INTEGER,
    "customsMinor" INTEGER,
    "prices" JSONB NOT NULL,
    "exitIp" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "price_observations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "proxies_alive_successRate_latencyMs_idx" ON "proxies"("alive", "successRate" DESC, "latencyMs");

-- CreateIndex
CREATE UNIQUE INDEX "tracked_products_marketplace_externalId_key" ON "tracked_products"("marketplace", "externalId");

-- CreateIndex
CREATE INDEX "price_observations_trackedProductId_observedAt_idx" ON "price_observations"("trackedProductId", "observedAt" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "price_observations_jobId_trackedProductId_key" ON "price_observations"("jobId", "trackedProductId");

-- AddForeignKey
ALTER TABLE "price_observations" ADD CONSTRAINT "price_observations_trackedProductId_fkey" FOREIGN KEY ("trackedProductId") REFERENCES "tracked_products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

