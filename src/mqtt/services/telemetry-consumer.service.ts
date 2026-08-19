import { Injectable, Logger } from '@nestjs/common';
import { Device, OrderStatus, Prisma } from '@prisma/client';
import { DeviceRepository } from '../../devices/repositories/device.repository';
import { DeviceSecretService } from '../../devices/services/device-secret.service';
import { PrismaService } from '../../prisma/prisma.service';
import { TelemetryRepository } from '../../telemetry/repositories/telemetry.repository';
import type { StatusPayload, TelemetryPayload } from '../mqtt-message.types';

const ACTIVE_ORDER_STATUSES = [
  OrderStatus.ASSIGNED,
  OrderStatus.PICKED_UP,
  OrderStatus.IN_TRANSIT,
  OrderStatus.AT_CHECKPOINT,
];

const TRUSTED_TTL_MS = 5 * 60 * 1000;

@Injectable()
export class TelemetryConsumerService {
  private readonly logger = new Logger(TelemetryConsumerService.name);
  private readonly trustedDevices = new Map<string, number>();

  constructor(
    private readonly deviceRepository: DeviceRepository,
    private readonly deviceSecretService: DeviceSecretService,
    private readonly telemetryRepository: TelemetryRepository,
    private readonly prisma: PrismaService,
  ) {}

  async handleTelemetry(deviceId: string, rawPayload: string) {
    const device = await this.deviceRepository.findActiveById(deviceId);
    if (!device) {
      this.logger.warn(
        `Rejected telemetry from unknown/inactive device: ${deviceId}`,
      );
      return;
    }

    const payload = this.parseTelemetry(deviceId, rawPayload);
    if (!payload) {
      return;
    }

    if (
      !this.isTrusted(device.id) &&
      !(await this.verifyDeviceSecret(device, payload.secret))
    ) {
      return;
    }

    await this.persistTelemetry(device, payload);
  }

  async handleStatus(deviceId: string, rawPayload: string) {
    const device = await this.deviceRepository.findActiveById(deviceId);
    if (!device) {
      this.logger.warn(
        `Rejected status from unknown/inactive device: ${deviceId}`,
      );
      return;
    }

    const payload = this.parseStatus(deviceId, rawPayload);
    if (!payload) {
      return;
    }

    await this.deviceRepository.update(device.id, {
      lastSeenAt: payload.eventTime ?? new Date(),
    });
  }

  private parseTelemetry(
    deviceId: string,
    rawPayload: string,
  ): TelemetryPayload | null {
    let json: Record<string, unknown>;
    try {
      json = JSON.parse(rawPayload) as Record<string, unknown>;
    } catch {
      this.logger.warn(`Invalid JSON telemetry from device: ${deviceId}`);
      return null;
    }

    const lat = Number(json.lat);
    const lng = Number(json.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      this.logger.warn(`Telemetry from ${deviceId} is missing valid lat/lng`);
      return null;
    }

    const clean: Record<string, unknown> = { ...json };
    delete clean.secret;

    return {
      temperature: this.optionalNumber(json.temperature),
      humidity: this.optionalNumber(json.humidity),
      battery: this.optionalNumber(json.battery),
      speed: this.optionalNumber(json.speed),
      lat,
      lng,
      eventTime: this.parseEventTime(json.event_time),
      secret: typeof json.secret === 'string' ? json.secret : undefined,
      raw: clean,
    };
  }

  private parseStatus(
    deviceId: string,
    rawPayload: string,
  ): StatusPayload | null {
    let json: Record<string, unknown>;
    try {
      json = JSON.parse(rawPayload) as Record<string, unknown>;
    } catch {
      this.logger.warn(`Invalid JSON status from device: ${deviceId}`);
      return null;
    }

    return {
      status: ['online', 'offline', 'booting'].includes(String(json.status))
        ? (json.status as StatusPayload['status'])
        : undefined,
      battery: this.optionalNumber(json.battery),
      eventTime: this.parseEventTime(json.event_time),
      raw: json,
    };
  }

  private parseEventTime(value: unknown): Date | undefined {
    if (typeof value === 'string' || typeof value === 'number') {
      const date = new Date(value);
      if (!Number.isNaN(date.getTime())) {
        return date;
      }
    }
    return undefined;
  }

  private async verifyDeviceSecret(
    device: Device,
    secret: string | undefined,
  ): Promise<boolean> {
    if (!secret) {
      this.logger.warn(`Device ${device.id} sent telemetry without a secret`);
      return false;
    }

    const valid = await this.deviceSecretService.verifySecret(
      secret,
      device.secretHash,
    );
    if (!valid) {
      this.logger.warn(`Device ${device.id} sent an invalid secret`);
      return false;
    }

    this.markTrusted(device.id);
    return true;
  }

  private isTrusted(deviceId: string): boolean {
    const expiresAt = this.trustedDevices.get(deviceId);
    if (!expiresAt) {
      return false;
    }
    if (expiresAt < Date.now()) {
      this.trustedDevices.delete(deviceId);
      return false;
    }
    return true;
  }

  private markTrusted(deviceId: string) {
    this.trustedDevices.set(deviceId, Date.now() + TRUSTED_TTL_MS);
  }

  private async persistTelemetry(device: Device, payload: TelemetryPayload) {
    const vehicleId = device.vehicleId;
    const orderId = vehicleId
      ? await this.resolveActiveOrderId(vehicleId)
      : null;
    const now = new Date();
    const eventTime = payload.eventTime ?? now;

    const record = await this.telemetryRepository.create({
      deviceId: device.id,
      vehicleId,
      orderId,
      temperature: payload.temperature,
      humidity: payload.humidity,
      battery: payload.battery,
      speedKmh: payload.speed,
      lat: payload.lat,
      lng: payload.lng,
      eventTime,
      raw: payload.raw as Prisma.InputJsonValue,
    });

    await this.deviceRepository.update(device.id, {
      lastLat: payload.lat,
      lastLng: payload.lng,
      lastSeenAt: now,
    });

    if (vehicleId) {
      await this.prisma.vehicle
        .update({
          where: { id: vehicleId },
          data: { lastLat: payload.lat, lastLng: payload.lng, lastSeenAt: now },
        })
        .catch((error: Error) =>
          this.logger.warn(
            `Failed to update vehicle ${vehicleId}: ${error.message}`,
          ),
        );
    }

    this.logger.debug(
      `Stored telemetry ${record.id} for device ${device.id} (order ${orderId ?? 'none'})`,
    );
  }

  private async resolveActiveOrderId(
    vehicleId: string,
  ): Promise<string | null> {
    const order = await this.prisma.order.findFirst({
      where: {
        assignedVehicleId: vehicleId,
        status: { in: ACTIVE_ORDER_STATUSES },
      },
      orderBy: { updatedAt: 'desc' },
      select: { id: true },
    });
    return order?.id ?? null;
  }

  private optionalNumber(value: unknown): number | undefined {
    if (value === null || value === undefined || value === '') {
      return undefined;
    }
    const num = Number(value);
    return Number.isFinite(num) ? num : undefined;
  }
}
