-- CreateTable
CREATE TABLE "CameraSnapshot" (
    "id" TEXT NOT NULL,
    "deviceId" TEXT NOT NULL,
    "vehicleId" TEXT,
    "orderId" TEXT,
    "url" TEXT NOT NULL,
    "capturedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CameraSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CameraSnapshot_deviceId_capturedAt_idx" ON "CameraSnapshot"("deviceId", "capturedAt");
CREATE INDEX "CameraSnapshot_vehicleId_capturedAt_idx" ON "CameraSnapshot"("vehicleId", "capturedAt");
CREATE INDEX "CameraSnapshot_orderId_capturedAt_idx" ON "CameraSnapshot"("orderId", "capturedAt");

-- AddForeignKey
ALTER TABLE "CameraSnapshot" ADD CONSTRAINT "CameraSnapshot_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "Device"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CameraSnapshot" ADD CONSTRAINT "CameraSnapshot_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE SET NULL ON UPDATE CASCADE;
