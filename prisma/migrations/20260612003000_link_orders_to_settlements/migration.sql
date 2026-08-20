-- AlterTable
ALTER TABLE "Order" ADD COLUMN "originSettlementId" TEXT,
ADD COLUMN "destinationSettlementId" TEXT;

-- CreateIndex
CREATE INDEX "Order_originSettlementId_idx" ON "Order"("originSettlementId");

-- CreateIndex
CREATE INDEX "Order_destinationSettlementId_idx" ON "Order"("destinationSettlementId");

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_originSettlementId_fkey"
FOREIGN KEY ("originSettlementId") REFERENCES "Settlement"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_destinationSettlementId_fkey"
FOREIGN KEY ("destinationSettlementId") REFERENCES "Settlement"("id") ON DELETE SET NULL ON UPDATE CASCADE;
