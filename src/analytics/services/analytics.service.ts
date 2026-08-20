import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

const EARTH_RADIUS_KM = 6371;
const FUEL_L_PER_KM = 0.33;
const FUEL_PRICE_TENGE = 450;
const BASELINE_EMPTY_RATIO = 0.4;
const OPTIMIZED_EMPTY_RATIO = 0.12;
const AVG_SPEED_KMH = 60;

function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

function haversineKm(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return EARTH_RADIUS_KM * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

@Injectable()
export class AnalyticsService {
  constructor(private readonly prisma: PrismaService) {}

  async flows(days?: number) {
    const since = days ? new Date(Date.now() - days * 86400000) : undefined;

    const orders = await this.prisma.order.findMany({
      where: {
        status: { not: 'CANCELLED' },
        createdAt: since ? { gte: since } : undefined,
      },
      select: {
        originCity: true,
        origin: true,
        destinationCity: true,
        destination: true,
        weight: true,
        volume: true,
      },
    });

    const map = new Map<
      string,
      {
        origin: string;
        destination: string;
        count: number;
        totalWeight: number;
        totalVolume: number;
      }
    >();

    for (const order of orders) {
      const origin = order.originCity || order.origin;
      const destination = order.destinationCity || order.destination;
      const key = `${origin}__${destination}`;
      const entry = map.get(key) ?? {
        origin,
        destination,
        count: 0,
        totalWeight: 0,
        totalVolume: 0,
      };
      entry.count += 1;
      entry.totalWeight += order.weight;
      entry.totalVolume += order.volume;
      map.set(key, entry);
    }

    const flows = [...map.values()]
      .map((f) => ({
        ...f,
        totalWeight: Math.round(f.totalWeight),
        totalVolume: Math.round(f.totalVolume),
      }))
      .sort((a, b) => b.count - a.count);

    return {
      flows,
      totalOrders: orders.length,
      totalWeight: Math.round(orders.reduce((s, o) => s + o.weight, 0)),
      totalVolume: Math.round(orders.reduce((s, o) => s + o.volume, 0)),
      periodDays: days ?? null,
      generatedAt: new Date().toISOString(),
    };
  }

  async regionalSummary() {
    const [ordersCount, routeAgg, activeVehicles, readingsCount, inTransit] =
      await Promise.all([
        this.prisma.order.count({
          where: { status: { not: 'CANCELLED' } },
        }),
        this.prisma.route.aggregate({ _sum: { distanceKm: true } }),
        this.prisma.vehicle.count({
          where: {
            lastSeenAt: {
              gte: new Date(Date.now() - 10 * 60 * 1000),
            },
          },
        }),
        this.prisma.telemetryRecord.count(),
        this.prisma.order.count({
          where: { status: { in: ['ASSIGNED', 'IN_TRANSIT'] } },
        }),
      ]);

    let totalKm = routeAgg._sum.distanceKm ?? 0;

    if (totalKm === 0) {
      const orders = await this.prisma.order.findMany({
        where: {
          status: { not: 'CANCELLED' },
          originLat: { not: null },
          destinationLat: { not: null },
        },
        select: {
          originLat: true,
          originLng: true,
          destinationLat: true,
          destinationLng: true,
        },
      });
      totalKm = orders.reduce(
        (sum, o) =>
          sum +
          haversineKm(
            Number(o.originLat),
            Number(o.originLng),
            Number(o.destinationLat),
            Number(o.destinationLng),
          ),
        0,
      );
    }

    const delivered = await this.prisma.order.count({
      where: { status: 'DELIVERED' },
    });

    return {
      totalOrders: ordersCount,
      deliveredOrders: delivered,
      activeTrips: inTransit,
      activeVehicles,
      totalTelemetryReadings: readingsCount,
      totalKm: Math.round(totalKm),
      generatedAt: new Date().toISOString(),
    };
  }

  async economic() {
    const summary = await this.regionalSummary();
    const totalKm = summary.totalKm;

    const emptyKmBaseline = totalKm * BASELINE_EMPTY_RATIO;
    const emptyKmOptimized = totalKm * OPTIMIZED_EMPTY_RATIO;
    const savedEmptyKm = emptyKmBaseline - emptyKmOptimized;

    const totalFuelL = totalKm * FUEL_L_PER_KM;
    const savedFuelL = savedEmptyKm * FUEL_L_PER_KM;
    const savedMoneyTenge = Math.round(savedFuelL * FUEL_PRICE_TENGE);
    const savedHours = Math.round(savedEmptyKm / AVG_SPEED_KMH);

    return {
      totalKm,
      emptyKmBaseline: Math.round(emptyKmBaseline),
      emptyKmOptimized: Math.round(emptyKmOptimized),
      savedEmptyKm: Math.round(savedEmptyKm),
      totalFuelLiters: Math.round(totalFuelL),
      savedFuelLiters: Math.round(savedFuelL),
      fuelPriceTengePerLiter: FUEL_PRICE_TENGE,
      savedMoneyTenge,
      savedHours,
      assumptions: {
        baselineEmptyRatio: BASELINE_EMPTY_RATIO,
        optimizedEmptyRatio: OPTIMIZED_EMPTY_RATIO,
        fuelLitersPerKm: FUEL_L_PER_KM,
        fuelPriceTengePerLiter: FUEL_PRICE_TENGE,
        avgSpeedKmh: AVG_SPEED_KMH,
        note: 'Цифры основаны на фактических маршрутах системы и средних отраслевых нормах (порожний пробег ~40% по данным кейса).',
      },
      generatedAt: new Date().toISOString(),
    };
  }
}
