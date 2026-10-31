-- CreateTable
CREATE TABLE "product_subscriptions" (
    "userId" UUID NOT NULL,
    "trackedProductId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "product_subscriptions_pkey" PRIMARY KEY ("userId","trackedProductId")
);

-- CreateIndex
CREATE INDEX "product_subscriptions_trackedProductId_idx" ON "product_subscriptions"("trackedProductId");

-- AddForeignKey
ALTER TABLE "product_subscriptions" ADD CONSTRAINT "product_subscriptions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_subscriptions" ADD CONSTRAINT "product_subscriptions_trackedProductId_fkey" FOREIGN KEY ("trackedProductId") REFERENCES "tracked_products"("id") ON DELETE CASCADE ON UPDATE CASCADE;
