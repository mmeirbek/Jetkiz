-- AddForeignKey
ALTER TABLE "SensorAlert" ADD CONSTRAINT "SensorAlert_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SensorAlert" ADD CONSTRAINT "SensorAlert_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE SET NULL ON UPDATE CASCADE;