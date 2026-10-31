-- DropIndex
DROP INDEX "tracked_products_marketplace_externalId_key";

-- AlterTable
ALTER TABLE "tracked_products" ADD COLUMN     "cityId" TEXT NOT NULL DEFAULT '';

-- CreateTable
CREATE TABLE "handbooks" (
    "key" TEXT NOT NULL,
    "data" JSONB NOT NULL,
    "fetchedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "handbooks_pkey" PRIMARY KEY ("key")
);

-- CreateIndex
CREATE UNIQUE INDEX "tracked_products_marketplace_externalId_cityId_key" ON "tracked_products"("marketplace", "externalId", "cityId");

