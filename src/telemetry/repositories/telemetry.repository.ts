import { Injectable } from '@nestjs/common';
import { Prisma, TelemetryRecord } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

type Range = { gte?: Date; lte?: Date };

@Injectable()
export class TelemetryRepository {
  constructor(private readonly prisma: PrismaService) {}

  create(
    data: Prisma.TelemetryRecordUncheckedCreateInput,
  ): Promise<TelemetryRecord> {
    return this.prisma.telemetryRecord.create({ data });
  }

  findLastByDevice(deviceId: string): Promise<TelemetryRecord | null> {
    return this.prisma.telemetryRecord.findFirst({
      where: { deviceId },
      orderBy: { eventTime: 'desc' },
    });
  }

  findRangeByDevice(
    deviceId: string,
    range: Range,
    take = 10_000,
  ): Promise<TelemetryRecord[]> {
    return this.prisma.telemetryRecord.findMany({
      where: { deviceId, eventTime: range },
      orderBy: { eventTime: 'asc' },
      take,
    });
  }

  findLastByVehicle(vehicleId: string): Promise<TelemetryRecord | null> {
    return this.prisma.telemetryRecord.findFirst({
      where: { vehicleId },
      orderBy: { eventTime: 'desc' },
    });
  }

  findRangeByVehicle(
    vehicleId: string,
    range: Range,
    take = 10_000,
  ): Promise<TelemetryRecord[]> {
    return this.prisma.telemetryRecord.findMany({
      where: { vehicleId, eventTime: range },
      orderBy: { eventTime: 'asc' },
      take,
    });
  }

  findLastByOrder(orderId: string): Promise<TelemetryRecord | null> {
    return this.prisma.telemetryRecord.findFirst({
      where: { orderId },
      orderBy: { eventTime: 'desc' },
    });
  }

  findRangeByOrder(
    orderId: string,
    range: Range,
    take = 10_000,
  ): Promise<TelemetryRecord[]> {
    return this.prisma.telemetryRecord.findMany({
      where: { orderId, eventTime: range },
      orderBy: { eventTime: 'asc' },
      take,
    });
  }
}
