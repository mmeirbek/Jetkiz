-- CreateEnum
CREATE TYPE "DeviceStatus" AS ENUM ('ACTIVE', 'SUSPENDED', 'RETIRED');

-- CreateEnum
CREATE TYPE "Metric" AS ENUM ('TEMPERATURE', 'HUMIDITY', 'BATTERY', 'SPEED');

-- CreateEnum
CREATE TYPE "RuleOperator" AS ENUM ('GT', 'GTE', 'LT', 'LTE');

-- CreateEnum
CREATE TYPE "Severity" AS ENUM ('WARNING', 'CRITICAL');

-- CreateEnum
CREATE TYPE "AlertStatus" AS ENUM ('OPEN', 'ACKNOWLEDGED', 'RESOLVED');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "OrderStatus" ADD VALUE 'PICKED_UP';
ALTER TYPE "OrderStatus" ADD VALUE 'AT_CHECKPOINT';

-- AlterTable
ALTER TABLE "CarrierProfile" ADD COLUMN     "completedOrders" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "rating" DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "Vehicle" ADD COLUMN     "lastLat" DOUBLE PRECISION,
ADD COLUMN     "lastLng" DOUBLE PRECISION,
ADD COLUMN     "lastSeenAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "assignedVehicleId" TEXT,
ADD COLUMN     "isReefer" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "tempMax" DOUBLE PRECISION,
ADD COLUMN     "tempMin" DOUBLE PRECISION;

-- CreateTable
CREATE TABLE "Device" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "secretHash" TEXT NOT NULL,
    "status" "DeviceStatus" NOT NULL DEFAULT 'ACTIVE',
    "vehicleId" TEXT,
    "lastLat" DOUBLE PRECISION,
    "lastLng" DOUBLE PRECISION,
    "lastSeenAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Device_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TelemetryRecord" (
    "id" TEXT NOT NULL,
    "deviceId" TEXT NOT NULL,
    "vehicleId" TEXT,
    "orderId" TEXT,
    "temperature" DOUBLE PRECISION,
    "humidity" DOUBLE PRECISION,
    "battery" DOUBLE PRECISION,
    "speedKmh" DOUBLE PRECISION,
    "lat" DOUBLE PRECISION NOT NULL,
    "lng" DOUBLE PRECISION NOT NULL,
    "eventTime" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "raw" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TelemetryRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SensorRule" (
    "id" TEXT NOT NULL,
    "deviceId" TEXT,
    "metric" "Metric" NOT NULL,
    "operator" "RuleOperator" NOT NULL,
    "threshold" DOUBLE PRECISION NOT NULL,
    "severity" "Severity" NOT NULL DEFAULT 'WARNING',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SensorRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SensorAlert" (
    "id" TEXT NOT NULL,
    "deviceId" TEXT NOT NULL,
    "vehicleId" TEXT,
    "orderId" TEXT,
    "ruleId" TEXT,
    "metric" "Metric" NOT NULL,
    "value" DOUBLE PRECISION NOT NULL,
    "severity" "Severity" NOT NULL,
    "message" TEXT NOT NULL,
    "status" "AlertStatus" NOT NULL DEFAULT 'OPEN',
    "acknowledgedAt" TIMESTAMP(3),
    "acknowledgedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SensorAlert_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Device_vehicleId_key" ON "Device"("vehicleId");

-- CreateIndex
CREATE INDEX "Device_status_idx" ON "Device"("status");

-- CreateIndex
CREATE INDEX "Device_lastSeenAt_idx" ON "Device"("lastSeenAt");

-- CreateIndex
CREATE INDEX "TelemetryRecord_deviceId_eventTime_idx" ON "TelemetryRecord"("deviceId", "eventTime");

-- CreateIndex
CREATE INDEX "TelemetryRecord_vehicleId_eventTime_idx" ON "TelemetryRecord"("vehicleId", "eventTime");

-- CreateIndex
CREATE INDEX "TelemetryRecord_orderId_eventTime_idx" ON "TelemetryRecord"("orderId", "eventTime");

-- CreateIndex
CREATE INDEX "SensorRule_deviceId_idx" ON "SensorRule"("deviceId");

-- CreateIndex
CREATE INDEX "SensorRule_isActive_idx" ON "SensorRule"("isActive");

-- CreateIndex
CREATE INDEX "SensorAlert_deviceId_idx" ON "SensorAlert"("deviceId");

-- CreateIndex
CREATE INDEX "SensorAlert_status_createdAt_idx" ON "SensorAlert"("status", "createdAt");

-- CreateIndex
CREATE INDEX "SensorAlert_vehicleId_idx" ON "SensorAlert"("vehicleId");

-- CreateIndex
CREATE INDEX "SensorAlert_orderId_idx" ON "SensorAlert"("orderId");

-- CreateIndex
CREATE INDEX "Order_assignedVehicleId_idx" ON "Order"("assignedVehicleId");

-- AddForeignKey
ALTER TABLE "Device" ADD CONSTRAINT "Device_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TelemetryRecord" ADD CONSTRAINT "TelemetryRecord_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "Device"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SensorRule" ADD CONSTRAINT "SensorRule_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "Device"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SensorAlert" ADD CONSTRAINT "SensorAlert_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "Device"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SensorAlert" ADD CONSTRAINT "SensorAlert_ruleId_fkey" FOREIGN KEY ("ruleId") REFERENCES "SensorRule"("id") ON DELETE SET NULL ON UPDATE CASCADE;

