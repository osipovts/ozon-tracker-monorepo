-- CreateIndex
CREATE INDEX "product_subscriptions_userId_createdAt_idx" ON "product_subscriptions"("userId", "createdAt" DESC);
