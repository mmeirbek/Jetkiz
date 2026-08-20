-- CreateTable
CREATE TABLE "OrderPrediction" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "recommendation" TEXT NOT NULL,
    "riskLevel" TEXT NOT NULL,
    "bestDepartureTime" TIMESTAMP(3) NOT NULL,
    "expectedDelayMinutes" INTEGER NOT NULL,
    "shortExplanation" TEXT NOT NULL,
    "inputSnapshot" JSONB NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'rule',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OrderPrediction_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "OrderPrediction_orderId_key" ON "OrderPrediction"("orderId");

-- CreateIndex
CREATE INDEX "OrderPrediction_createdAt_idx" ON "OrderPrediction"("createdAt");

-- AddForeignKey
ALTER TABLE "OrderPrediction" ADD CONSTRAINT "OrderPrediction_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;