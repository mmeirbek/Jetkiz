import 'dotenv/config';
import { PrismaClient, OrderStatus } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import * as bcrypt from 'bcrypt';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

const ACTIVE_STATUSES = new Set([
  'ASSIGNED',
  'PICKED_UP',
  'IN_TRANSIT',
  'AT_CHECKPOINT',
]);

function tempForCargo(cargoType: string): number {
  const lower = cargoType.toLowerCase();
  if (lower.includes('вода') || lower.includes('продукт') || lower.includes('food') || lower.includes('молоко')) {
    return Number((3 + Math.random() * 4).toFixed(1));
  }
  if (lower.includes('топлив') || lower.includes('хим')) {
    return Number((18 + Math.random() * 6).toFixed(1));
  }
  return Number((22 + Math.random() * 8).toFixed(1));
}

async function main() {
  await prisma.telemetryRecord.deleteMany({
    where: { raw: { path: ['source'], equals: 'demo' } },
  });
  await prisma.device.deleteMany({
    where: { name: { startsWith: 'Демо-устройство' } },
  });

  const carriers = await prisma.carrierProfile.findMany();
  const vehiclesByCarrier = new Map<string, { id: string; plateNumber: string }[]>();
  for (const c of carriers) {
    const vehicles = await prisma.vehicle.findMany({
      where: { carrierId: c.id },
      select: { id: true, plateNumber: true },
    });
    vehiclesByCarrier.set(c.id, vehicles);
  }

  const devicesByCarrier = new Map<string, { id: string; vehicleId: string }[]>();
  const existingDeviceByVehicle = new Map<string, string>();
  const existingDevices = await prisma.device.findMany({
    where: { vehicleId: { not: null } },
    select: { id: true, vehicleId: true },
  });
  for (const d of existingDevices) {
    if (d.vehicleId) existingDeviceByVehicle.set(d.vehicleId, d.id);
  }

  for (const c of carriers) {
    const vehicles = vehiclesByCarrier.get(c.id) ?? [];
    const devices: { id: string; vehicleId: string }[] = [];
    for (const v of vehicles) {
      const existing = existingDeviceByVehicle.get(v.id);
      if (existing) {
        devices.push({ id: existing, vehicleId: v.id });
        continue;
      }
      const device = await prisma.device.create({
        data: {
          name: `Демо-устройство ${v.plateNumber}`,
          secretHash: await bcrypt.hash('demo-device-secret', 6),
          status: 'ACTIVE',
          vehicleId: v.id,
          lastSeenAt: new Date(),
        },
      });
      devices.push({ id: device.id, vehicleId: v.id });
    }
    devicesByCarrier.set(c.id, devices);
  }

  const orders = await prisma.order.findMany({
    where: {
      status: { in: [...ACTIVE_STATUSES] as OrderStatus[] },
      carrierId: { not: null },
      originLat: { not: null },
      originLng: { not: null },
      destinationLat: { not: null },
      destinationLng: { not: null },
    },
  });

  let inserted = 0;
  let skippedNoDevice = 0;

  for (const order of orders) {
    if (!order.carrierId) {
      skippedNoDevice++;
      continue;
    }
    const devices = devicesByCarrier.get(order.carrierId) ?? [];
    if (devices.length === 0) {
      skippedNoDevice++;
      continue;
    }
    const device = devices[order.id.length % devices.length];

    const midLat = (order.originLat! + order.destinationLat!) / 2;
    const midLng = (order.originLng! + order.destinationLng!) / 2;

    await prisma.telemetryRecord.create({
      data: {
        deviceId: device.id,
        vehicleId: device.vehicleId,
        orderId: order.id,
        temperature: tempForCargo(order.cargoType),
        humidity: Number((35 + Math.random() * 25).toFixed(1)),
        battery: Number((70 + Math.random() * 25).toFixed(1)),
        speedKmh: Number((40 + Math.random() * 30).toFixed(1)),
        lat: midLat,
        lng: midLng,
        eventTime: new Date(),
        raw: { source: 'demo' },
      },
    });

    await prisma.device.update({
      where: { id: device.id },
      data: { lastLat: midLat, lastLng: midLng, lastSeenAt: new Date() },
    });

    inserted++;
  }

  console.log('Demo telemetry seed complete!');
  console.log(`  Active demo orders:  ${orders.length}`);
  console.log(`  Telemetry inserted:  ${inserted}`);
  console.log(`  Skipped (no carrier/device): ${skippedNoDevice}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => pool.end());