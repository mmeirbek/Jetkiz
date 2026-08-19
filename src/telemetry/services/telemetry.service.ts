import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Order, TelemetryRecord, UserRole } from '@prisma/client';
import { CarrierProfileRepository } from '../../carrier/repositories/carrier-profile.repository';
import type { AuthUser } from '../../common/types/auth-user.type';
import { PrismaService } from '../../prisma/prisma.service';
import {
  BUCKET_MINUTES,
  TelemetryBucket,
  TelemetryHistoryQueryDto,
} from '../dto/telemetry-history-query.dto';
import { TelemetryRepository } from '../repositories/telemetry.repository';

type AggregateKey = 'temperature' | 'humidity' | 'battery' | 'speed';

@Injectable()
export class TelemetryService {
  constructor(
    private readonly telemetryRepository: TelemetryRepository,
    private readonly carrierProfileRepository: CarrierProfileRepository,
    private readonly prisma: PrismaService,
  ) {}

  async getDeviceLast(authUser: AuthUser, deviceId: string) {
    const device = await this.prisma.device.findUnique({
      where: { id: deviceId },
      select: { id: true, vehicleId: true },
    });
    if (!device) {
      throw new NotFoundException('Device not found');
    }
    await this.ensureVehicleAccess(authUser, device.vehicleId);

    const telemetry = await this.telemetryRepository.findLastByDevice(deviceId);
    return { telemetry };
  }

  async getDeviceHistory(
    authUser: AuthUser,
    deviceId: string,
    query: TelemetryHistoryQueryDto,
  ) {
    const device = await this.prisma.device.findUnique({
      where: { id: deviceId },
      select: { id: true, vehicleId: true },
    });
    if (!device) {
      throw new NotFoundException('Device not found');
    }
    await this.ensureVehicleAccess(authUser, device.vehicleId);

    const { from, to, bucket } = this.resolveRange(query);
    const records = await this.telemetryRepository.findRangeByDevice(deviceId, {
      gte: from,
      lte: to,
    });

    return {
      deviceId,
      bucket,
      points: this.bucketize(records, bucket),
    };
  }

  async getVehicleLast(authUser: AuthUser, vehicleId: string) {
    await this.ensureVehicleAccess(authUser, vehicleId);
    const telemetry =
      await this.telemetryRepository.findLastByVehicle(vehicleId);
    return { telemetry };
  }

  async getVehicleHistory(
    authUser: AuthUser,
    vehicleId: string,
    query: TelemetryHistoryQueryDto,
  ) {
    await this.ensureVehicleAccess(authUser, vehicleId);

    const { from, to, bucket } = this.resolveRange(query);
    const records = await this.telemetryRepository.findRangeByVehicle(
      vehicleId,
      { gte: from, lte: to },
    );

    return {
      vehicleId,
      bucket,
      points: this.bucketize(records, bucket),
    };
  }

  async getOrderLive(authUser: AuthUser, orderId: string) {
    const order = await this.findVisibleOrderOrThrow(authUser, orderId);
    const last = await this.telemetryRepository.findLastByOrder(order.id);
    return { telemetry: last };
  }

  async getOrderHistory(
    authUser: AuthUser,
    orderId: string,
    query: TelemetryHistoryQueryDto,
  ) {
    const order = await this.findVisibleOrderOrThrow(authUser, orderId);

    const { from, to, bucket } = this.resolveRange(query);
    const records = await this.telemetryRepository.findRangeByOrder(order.id, {
      gte: from,
      lte: to,
    });

    return {
      orderId: order.id,
      bucket,
      points: this.bucketize(records, bucket),
    };
  }

  private resolveRange(query: TelemetryHistoryQueryDto) {
    const to = query.to ? new Date(query.to) : new Date();
    const from = query.from
      ? new Date(query.from)
      : new Date(to.getTime() - 24 * 3600_000);
    const bucket = query.bucket ?? TelemetryBucket.HOUR_1;
    return { from, to, bucket };
  }

  private bucketize(records: TelemetryRecord[], bucket: TelemetryBucket) {
    const bucketMs = BUCKET_MINUTES[bucket] * 60_000;

    type Accumulator = {
      count: number;
      lat: number | null;
      lng: number | null;
      metrics: Partial<
        Record<
          AggregateKey,
          { sum: number; count: number; min: number; max: number }
        >
      >;
    };

    const buckets = new Map<number, Accumulator>();

    for (const record of records) {
      const key = Math.floor(record.eventTime.getTime() / bucketMs) * bucketMs;
      let acc = buckets.get(key);
      if (!acc) {
        acc = { count: 0, lat: null, lng: null, metrics: {} };
        buckets.set(key, acc);
      }

      acc.count += 1;
      acc.lat = acc.lat ?? record.lat;
      acc.lng = acc.lng ?? record.lng;

      const entries: Array<[AggregateKey, number | null]> = [
        ['temperature', record.temperature],
        ['humidity', record.humidity],
        ['battery', record.battery],
        ['speed', record.speedKmh],
      ];

      for (const [metric, value] of entries) {
        if (value === null || value === undefined) {
          continue;
        }
        const current = acc.metrics[metric] ?? {
          sum: 0,
          count: 0,
          min: value,
          max: value,
        };
        current.sum += value;
        current.count += 1;
        current.min = Math.min(current.min, value);
        current.max = Math.max(current.max, value);
        acc.metrics[metric] = current;
      }
    }

    return Array.from(buckets.entries())
      .sort((a, b) => a[0] - b[0])
      .map(([time, acc]) => {
        const aggregates: Record<
          AggregateKey,
          { avg: number | null; min: number | null; max: number | null } | null
        > = {
          temperature: null,
          humidity: null,
          battery: null,
          speed: null,
        };
        for (const metric of [
          'temperature',
          'humidity',
          'battery',
          'speed',
        ] as const) {
          const m = acc.metrics[metric];
          aggregates[metric] = m
            ? {
                avg: Number((m.sum / m.count).toFixed(2)),
                min: m.min,
                max: m.max,
              }
            : null;
        }
        return {
          time: new Date(time).toISOString(),
          count: acc.count,
          lat: acc.lat,
          lng: acc.lng,
          ...aggregates,
        };
      });
  }

  private async ensureVehicleAccess(
    authUser: AuthUser,
    vehicleId: string | null,
  ) {
    if (authUser.role === UserRole.SUPERADMIN) {
      return;
    }
    if (!vehicleId) {
      throw new ForbiddenException(
        'Device is not bound to a vehicle visible to this user',
      );
    }

    const carrierProfile = await this.carrierProfileRepository.findByUserId(
      authUser.id,
    );
    const vehicle = await this.prisma.vehicle.findFirst({
      where: { id: vehicleId, carrierId: carrierProfile?.id },
      select: { id: true },
    });
    if (!vehicle) {
      throw new NotFoundException('Vehicle not found');
    }
  }

  private async findVisibleOrderOrThrow(authUser: AuthUser, orderId: string) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
    });
    if (!order) {
      throw new NotFoundException('Order not found');
    }

    if (authUser.role === UserRole.SUPERADMIN) {
      return order;
    }
    if (order.clientId === authUser.id) {
      return order;
    }
    if (await this.isAssignedCarrier(authUser.id, order)) {
      return order;
    }

    throw new NotFoundException('Order not found');
  }

  private async isAssignedCarrier(userId: string, order: Order) {
    if (!order.carrierId) {
      return false;
    }
    const carrierProfile =
      await this.carrierProfileRepository.findByUserId(userId);
    return carrierProfile?.id === order.carrierId;
  }
}
