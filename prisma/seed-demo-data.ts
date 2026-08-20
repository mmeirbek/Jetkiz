import 'dotenv/config';
import { PrismaClient, OrderStatus, UserRole } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import * as bcrypt from 'bcrypt';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

const clients = [
  { email: 'astana-logistics@mail.kz', firstName: 'Асхат', lastName: 'Нурланов', company: 'ТОО Astana Logistics', city: 'Astana', phone: '+77011112233' },
  { email: 'almaty-trade@mail.kz', firstName: 'Дамир', lastName: 'Сериков', company: 'ТОО Almaty Trade', city: 'Almaty', phone: '+77022223344' },
  { email: 'aktau-shipping@mail.kz', firstName: 'Марат', lastName: 'Кусаинов', company: 'ТОО Aktau Shipping', city: 'Aktau', phone: '+77033334455' },
  { email: 'shymkent-food@mail.kz', firstName: 'Бахыт', lastName: 'Омаров', company: 'ТОО Shymkent Food', city: 'Shymkent', phone: '+77044445566' },
  { email: 'karaganda-auto@mail.kz', firstName: 'Сергей', lastName: 'Иванов', company: 'ТОО Karaganda Auto Parts', city: 'Karaganda', phone: '+77055556677' },
  { email: 'atyrau-oil@mail.kz', firstName: 'Руслан', lastName: 'Ермеков', company: 'ТОО Atyrau Oil Supply', city: 'Atyrau', phone: '+77066667788' },
  { email: 'kostanay-grain@mail.kz', firstName: 'Виктор', lastName: 'Фёдоров', company: 'ТОО Kostanay Grain Export', city: 'Kostanay', phone: '+77077778899' },
  { email: 'pavlodar-chem@mail.kz', firstName: 'Алексей', lastName: 'Козлов', company: 'ТОО Pavlodar Chemicals', city: 'Pavlodar', phone: '+77088889900' },
  { email: 'baku-logistics@mail.az', firstName: 'Эльчин', lastName: 'Мамедов', company: 'Baku Logistics LLC', city: 'Baku', phone: '+994501234567' },
  { email: 'tashkent-textile@mail.uz', firstName: 'Фаррух', lastName: 'Рахимов', company: 'Tashkent Textile Ltd', city: 'Tashkent', phone: '+998901234567' },
];

const carriers = [
  { email: 'dostyk-carrier@mail.kz', firstName: 'Ержан', lastName: 'Сагынтаев', company: 'ТОО Dostyk Trans', city: 'Dostyk', phone: '+77099990011', transportType: 'truck', experienceYears: 8 },
  { email: 'trans-express@mail.kz', firstName: 'Талгат', lastName: 'Муратов', company: 'Trans Express KZ', city: 'Almaty', phone: '+77099990022', transportType: 'truck', experienceYears: 12 },
  { email: 'caspian-logistics@mail.kz', firstName: 'Азамат', lastName: 'Беков', company: 'Caspian Logistics', city: 'Aktau', phone: '+77099990033', transportType: 'truck', experienceYears: 5 },
  { email: 'east-west-cargo@mail.kz', firstName: 'Нурлан', lastName: 'Ашимов', company: 'East West Cargo', city: 'Almaty', phone: '+77099990044', transportType: 'truck', experienceYears: 15 },
  { email: 'steppe-freight@mail.kz', firstName: 'Димаш', lastName: 'Кунанбаев', company: 'Steppe Freight KZ', city: 'Astana', phone: '+77099990055', transportType: 'truck', experienceYears: 3 },
];

const vehiclesData = [
  { brand: 'Volvo', model: 'FH16', year: 2022, plateNumber: '001AAA01', capacityTons: 20, cargoVolume: 82 },
  { brand: 'Scania', model: 'R500', year: 2023, plateNumber: '002BBB01', capacityTons: 22, cargoVolume: 86 },
  { brand: 'MAN', model: 'TGX', year: 2021, plateNumber: '003CCC01', capacityTons: 18, cargoVolume: 78 },
  { brand: 'Mercedes-Benz', model: 'Actros', year: 2023, plateNumber: '004DDD01', capacityTons: 24, cargoVolume: 90 },
  { brand: 'DAF', model: 'XF', year: 2022, plateNumber: '005EEE01', capacityTons: 20, cargoVolume: 82 },
  { brand: 'KamAZ', model: '6520', year: 2020, plateNumber: '006FFF01', capacityTons: 14, cargoVolume: 60 },
  { brand: 'Volvo', model: 'FH', year: 2021, plateNumber: '007GGG01', capacityTons: 20, cargoVolume: 82 },
];

async function main() {
  const saltRounds = Number(process.env.BCRYPT_SALT_ROUNDS ?? '12');

  // ── Clients ─────────────────────────────────────────────
  console.log('Creating clients...');
  let clientCount = 0;
  for (const c of clients) {
    const existing = await prisma.user.findUnique({ where: { email: c.email } });
    if (existing) continue;
    await prisma.user.create({
      data: {
        email: c.email,
        passwordHash: await bcrypt.hash('Client_123', saltRounds),
        role: UserRole.CLIENT,
        firstName: c.firstName,
        lastName: c.lastName,
        phone: c.phone,
        companyName: c.company,
        city: c.city,
        country: 'Kazakhstan',
        isActive: true,
      },
    });
    clientCount++;
  }
  console.log(`  Created ${clientCount} clients`);

  // ── Carriers ────────────────────────────────────────────
  console.log('Creating carriers...');
  let carrierCount = 0;
  const carrierUserIds: string[] = [];

  for (const c of carriers) {
    const existing = await prisma.user.findUnique({ where: { email: c.email } });
    if (existing) {
      carrierUserIds.push(existing.id);
      continue;
    }

    const user = await prisma.user.create({
      data: {
        email: c.email,
        passwordHash: await bcrypt.hash('Carrier_123', saltRounds),
        role: UserRole.CARRIER,
        firstName: c.firstName,
        lastName: c.lastName,
        phone: c.phone,
        companyName: c.company,
        city: c.city,
        country: 'Kazakhstan',
        isActive: true,
      },
    });

    await prisma.carrierProfile.create({
      data: {
        userId: user.id,
        transportType: c.transportType,
        experienceYears: c.experienceYears,
        isApproved: true,
        description: `Опытный перевозчик из ${c.city}`,
      },
    });

    carrierUserIds.push(user.id);
    carrierCount++;
  }
  console.log(`  Created ${carrierCount} carriers`);

  // ── Vehicles ────────────────────────────────────────────
  console.log('Creating vehicles...');
  let vehicleCount = 0;
  const profiles = await prisma.carrierProfile.findMany({
    where: { userId: { in: carrierUserIds } },
  });

  const vehicleMapping = [
    { profileIdx: 0, vehicleIdx: 0 },
    { profileIdx: 0, vehicleIdx: 5 },
    { profileIdx: 1, vehicleIdx: 1 },
    { profileIdx: 2, vehicleIdx: 2 },
    { profileIdx: 2, vehicleIdx: 6 },
    { profileIdx: 3, vehicleIdx: 3 },
    { profileIdx: 4, vehicleIdx: 4 },
  ];

  for (const { profileIdx, vehicleIdx } of vehicleMapping) {
    const profile = profiles[profileIdx];
    if (!profile) continue;
    const vehicle = vehiclesData[vehicleIdx % vehiclesData.length];
    const exists = await prisma.vehicle.findUnique({
      where: { carrierId_plateNumber: { carrierId: profile.id, plateNumber: vehicle.plateNumber } },
    });
    if (exists) continue;

    await prisma.vehicle.create({
      data: {
        carrierId: profile.id,
        type: profile.transportType,
        brand: vehicle.brand,
        model: vehicle.model,
        year: vehicle.year,
        plateNumber: vehicle.plateNumber,
        capacityTons: vehicle.capacityTons,
        cargoVolume: vehicle.cargoVolume,
      },
    });
    vehicleCount++;
  }
  console.log(`  Created ${vehicleCount} vehicles`);

  // ── Orders ──────────────────────────────────────────────
  console.log('Creating demo orders...');
  const allClients = await prisma.user.findMany({ where: { role: UserRole.CLIENT } });
  const existingOrderComments = new Set(
    (await prisma.order.findMany({
      where: { comment: { startsWith: 'DEMO_' } },
      select: { comment: true },
    })).map((o) => o.comment).filter(Boolean),
  );

  const originPools = [
    { city: 'Shanghai', country: 'China' },
    { city: 'Shenzhen', country: 'China' },
    { city: 'Ningbo', country: 'China' },
    { city: 'Dubai', country: 'UAE' },
    { city: 'Hamburg', country: 'Germany' },
    { city: 'Istanbul', country: 'Turkey' },
  ];

  const destPools = [
    { city: 'Almaty', country: 'Kazakhstan' },
    { city: 'Astana', country: 'Kazakhstan' },
    { city: 'Aktau', country: 'Kazakhstan' },
    { city: 'Shymkent', country: 'Kazakhstan' },
    { city: 'Karaganda', country: 'Kazakhstan' },
    { city: 'Atyrau', country: 'Kazakhstan' },
    { city: 'Baku', country: 'Azerbaijan' },
    { city: 'Tashkent', country: 'Uzbekistan' },
  ];

  const cargoTypes = ['Electronics', 'Industrial Equipment', 'Food Products', 'Textiles', 'Auto Parts', 'Chemicals'];
  const statuses = [OrderStatus.SEARCHING, OrderStatus.ASSIGNED, OrderStatus.IN_TRANSIT, OrderStatus.DELIVERED];

  function pick<T>(arr: T[]): T {
    return arr[Math.floor(Math.random() * arr.length)];
  }

  let orderCount = 0;
  for (let i = 0; i < 30; i++) {
    const comment = `DEMO_ORDER_${i}`;
    if (existingOrderComments.has(comment)) continue;

    const client = pick(allClients);
    const origin = pick(originPools);
    const dest = pick(destPools);
    const cargoType = pick(cargoTypes);
    const status = pick(statuses);
    const createdAt = new Date(Date.now() - Math.floor(Math.random() * 30) * 86400000);

    const order = await prisma.order.create({
      data: {
        clientId: client.id,
        carrierId: status !== OrderStatus.SEARCHING && profiles.length > 0
          ? pick(profiles).id
          : undefined,
        title: `${cargoType} Shipment #${2000 + i}`,
        cargoType,
        weight: Number((Math.random() * 2000 + 50).toFixed(2)),
        volume: Number((Math.random() * 30 + 1).toFixed(2)),
        origin: `${origin.city}, ${origin.country}`,
        originCity: origin.city,
        originCountry: origin.country,
        destination: `${dest.city}, ${dest.country}`,
        destinationCity: dest.city,
        destinationCountry: dest.country,
        estimatedPrice: Math.floor(Math.random() * 5000) + 300,
        estimatedDeliveryTime: Math.floor(Math.random() * 200) + 48,
        estimatedCarrierSearchTime: 60,
        status,
        comment,
        createdAt,
        updatedAt: new Date(),
      },
    });

    const events: { status: OrderStatus; location: string; timestamp: Date }[] = [
      { status: OrderStatus.ASSIGNED, location: origin.city, timestamp: createdAt },
    ];

    if (status === OrderStatus.IN_TRANSIT || status === OrderStatus.DELIVERED) {
      events.push({
        status: OrderStatus.IN_TRANSIT,
        location: 'Transit Hub',
        timestamp: new Date(createdAt.getTime() + 86400000),
      });
    }

    if (status === OrderStatus.DELIVERED) {
      events.push({
        status: OrderStatus.DELIVERED,
        location: dest.city,
        timestamp: new Date(createdAt.getTime() + 3 * 86400000),
      });
    }

    await prisma.orderTracking.createMany({
      data: events.map((e) => ({
        orderId: order.id,
        status: e.status,
        location: e.location,
        timestamp: e.timestamp,
        createdAt: e.timestamp,
      })),
    });

    if (status !== OrderStatus.SEARCHING) {
      await prisma.route.create({
        data: {
          orderId: order.id,
          distanceKm: Math.floor(Math.random() * 4000) + 500,
          durationMinutes: Math.floor(Math.random() * 6000) + 600,
          geometry: { type: 'LineString', coordinates: [] },
        },
      });
    }

    orderCount++;
  }

  console.log(`  Created ${orderCount} orders with tracking events and routes`);

  // ── Mangystau settlement orders ────────────────────────
  console.log('Creating Mangystau settlement orders...');
  const settlements = await prisma.settlement.findMany();
  const settlementById = new Map(settlements.map((s) => [s.id, s]));

  const mangystauRoutes = [
    { originId: 'aktau', destinationId: 'kuryk' },
    { originId: 'aktau', destinationId: 'zhanaozen' },
    { originId: 'aktau', destinationId: 'shetpe' },
    { originId: 'zhanaozen', destinationId: 'senek' },
    { originId: 'aktau', destinationId: 'beineu' },
    { originId: 'beineu', destinationId: 'akzhigit' },
    { originId: 'aktau', destinationId: 'zhetybai' },
    { originId: 'aktau', destinationId: 'mangystau' },
    { originId: 'kuryk', destinationId: 'senek' },
    { originId: 'shetpe', destinationId: 'taushyk' },
  ];

  const mangystauCargo = [
    'Стройматериалы',
    'Питьевая вода',
    'Продукты',
    'Топливо',
    'Запчасти',
    'Промышленное оборудование',
  ];
  const mangystauStatuses = [
    OrderStatus.SEARCHING,
    OrderStatus.ASSIGNED,
    OrderStatus.IN_TRANSIT,
    OrderStatus.DELIVERED,
  ];

  function haversineKm(
    lat1: number,
    lng1: number,
    lat2: number,
    lng2: number,
  ): number {
    const R = 6371;
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLng = ((lng2 - lng1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLng / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

  let mangystauOrderCount = 0;
  for (let i = 0; i < mangystauRoutes.length; i++) {
    const comment = `DEMO_MANGYSTAU_${i}`;
    if (existingOrderComments.has(comment)) continue;

    const { originId, destinationId } = mangystauRoutes[i];
    const originS = settlementById.get(originId);
    const destS = settlementById.get(destinationId);
    if (!originS || !destS) continue;

    const client = pick(allClients);
    const cargoType = pick(mangystauCargo);
    const status = pick(mangystauStatuses);
    const createdAt = new Date(
      Date.now() - Math.floor(Math.random() * 30) * 86400000,
    );
    const distanceKm = Number(
      haversineKm(
        originS.latitude,
        originS.longitude,
        destS.latitude,
        destS.longitude,
      ).toFixed(1),
    );
    const durationMinutes = Math.max(1, Math.round(distanceKm));

    const order = await prisma.order.create({
      data: {
        clientId: client.id,
        carrierId:
          status !== OrderStatus.SEARCHING && profiles.length > 0
            ? pick(profiles).id
            : undefined,
        title: `${cargoType} · ${originS.name} → ${destS.name}`,
        cargoType,
        weight: Number((Math.random() * 1500 + 200).toFixed(2)),
        volume: Number((Math.random() * 25 + 2).toFixed(2)),
        origin: originS.name,
        originSettlementId: originS.id,
        originCity: originS.name,
        originCountry: 'Kazakhstan',
        originLat: originS.latitude,
        originLng: originS.longitude,
        destination: destS.name,
        destinationSettlementId: destS.id,
        destinationCity: destS.name,
        destinationCountry: 'Kazakhstan',
        destinationLat: destS.latitude,
        destinationLng: destS.longitude,
        estimatedPrice: Math.floor(distanceKm * 2500) + 20000,
        estimatedDeliveryTime: Math.max(
          1,
          Math.ceil(durationMinutes / 60),
        ),
        estimatedCarrierSearchTime: 60,
        status,
        comment,
        createdAt,
        updatedAt: new Date(),
      },
    });

    await prisma.orderTracking.createMany({
      data: [
        {
          orderId: order.id,
          status: OrderStatus.ASSIGNED,
          location: originS.name,
          timestamp: createdAt,
          createdAt,
        },
        ...(status === OrderStatus.IN_TRANSIT ||
        status === OrderStatus.DELIVERED
          ? [
              {
                orderId: order.id,
                status: OrderStatus.IN_TRANSIT,
                location: 'Transit',
                timestamp: new Date(createdAt.getTime() + 86400000),
                createdAt: new Date(createdAt.getTime() + 86400000),
              },
            ]
          : []),
        ...(status === OrderStatus.DELIVERED
          ? [
              {
                orderId: order.id,
                status: OrderStatus.DELIVERED,
                location: destS.name,
                timestamp: new Date(createdAt.getTime() + 3 * 86400000),
                createdAt: new Date(createdAt.getTime() + 3 * 86400000),
              },
            ]
          : []),
      ],
    });

    if (status !== OrderStatus.SEARCHING) {
      await prisma.route.create({
        data: {
          orderId: order.id,
          distanceKm,
          durationMinutes,
          geometry: { type: 'LineString', coordinates: [] },
        },
      });
    }

    mangystauOrderCount++;
  }
  console.log(`  Created ${mangystauOrderCount} Mangystau settlement orders`);

  console.log('\nDemo data seed complete!');
  console.log(`  Clients:   ${clientCount} new (${allClients.length} total)`);
  console.log(`  Carriers:  ${carrierCount} new`);
  console.log(`  Vehicles:  ${vehicleCount} new`);
  console.log(`  Orders:    ${orderCount} new (+${mangystauOrderCount} Mangystau)`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
