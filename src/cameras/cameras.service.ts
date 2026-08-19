import { Injectable } from '@nestjs/common';
import { CameraSnapshot } from '@prisma/client';
import { existsSync, mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';
import { randomUUID } from 'crypto';
import type { AuthUser } from '../common/types/auth-user.type';
import { DeviceRepository } from '../devices/repositories/device.repository';
import { DeviceSecretService } from '../devices/services/device-secret.service';
import { PrismaService } from '../prisma/prisma.service';
import { RealtimeService } from '../realtime/realtime.service';
import type { CameraPayload } from './camera-message.types';

@Injectable()
export class CamerasService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly deviceRepository: DeviceRepository,
    private readonly deviceSecretService: DeviceSecretService,
    private readonly realtimeService: RealtimeService,
  ) {}

  async ingest(deviceId: string, rawPayload: string) {
    const device = await this.deviceRepository.findActiveById(deviceId);
    if (!device) return;

    let payload: CameraPayload;
    try {
      payload = JSON.parse(rawPayload) as CameraPayload;
    } catch {
      return;
    }

    if (
      typeof payload.secret !== 'string' ||
      !(await this.deviceSecretService.verifySecret(
        payload.secret,
        device.secretHash,
      ))
    ) {
      return;
    }

    const capturedAt = this.parseDate(payload.capturedAt) ?? new Date();
    const order = device.vehicleId
      ? await this.prisma.order.findFirst({
          where: {
            assignedVehicleId: device.vehicleId,
            status: {
              in: ['ASSIGNED', 'PICKED_UP', 'IN_TRANSIT', 'AT_CHECKPOINT'],
            },
          },
          orderBy: { updatedAt: 'desc' },
          select: { id: true },
        })
      : null;
    const url = this.resolveSnapshotUrl(payload);
    if (!url) return;

    const snapshot = await this.prisma.cameraSnapshot.create({
      data: {
        deviceId: device.id,
        vehicleId: device.vehicleId,
        orderId: order?.id ?? null,
        url,
        capturedAt,
      },
    });

    this.realtimeService.emitCamera({
      deviceId: snapshot.deviceId,
      vehicleId: snapshot.vehicleId,
      orderId: snapshot.orderId,
      url: snapshot.url,
      capturedAt: snapshot.capturedAt.toISOString(),
    });
  }

  async latestForOrder(authUser: AuthUser, orderId: string) {
    const snapshot = await this.prisma.cameraSnapshot.findFirst({
      where: {
        orderId,
        order: {
          OR: [{ clientId: authUser.id }, { carrier: { userId: authUser.id } }],
        },
      },
      orderBy: { capturedAt: 'desc' },
    });
    return { snapshot: snapshot ? this.toResponse(snapshot) : null };
  }

  async latestForDevice(authUser: AuthUser, deviceId: string) {
    const snapshot = await this.prisma.cameraSnapshot.findFirst({
      where: {
        deviceId,
        OR: [
          { device: { vehicle: { carrier: { userId: authUser.id } } } },
          { order: { clientId: authUser.id } },
          { order: { carrier: { userId: authUser.id } } },
        ],
      },
      orderBy: { capturedAt: 'desc' },
    });
    return { snapshot: snapshot ? this.toResponse(snapshot) : null };
  }

  private resolveSnapshotUrl(payload: CameraPayload): string | null {
    if (typeof payload.url === 'string' && payload.url.startsWith('http')) {
      return payload.url;
    }

    const source = payload.imageBase64 ?? payload.image;
    if (typeof source !== 'string') return null;
    const match = source.match(/^data:image\/(jpeg|jpg|png|webp);base64,(.+)$/);
    if (!match) return null;

    const extension =
      match[1] === 'jpeg' || match[1] === 'jpg' ? 'jpg' : match[1];
    const relativePath = `camera/${Date.now()}-${randomUUID()}.${extension}`;
    const target = join(process.cwd(), 'uploads', relativePath);
    const directory = join(process.cwd(), 'uploads', 'camera');
    if (!existsSync(directory)) mkdirSync(directory, { recursive: true });
    writeFileSync(target, Buffer.from(match[2], 'base64'));
    const base = process.env.PUBLIC_BASE_URL?.replace(/\/$/, '');
    return `${base ?? ''}/uploads/${relativePath}`;
  }

  private parseDate(value: string | number | undefined): Date | null {
    if (value === undefined) return null;
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  private toResponse(snapshot: CameraSnapshot) {
    return {
      id: snapshot.id,
      deviceId: snapshot.deviceId,
      vehicleId: snapshot.vehicleId,
      orderId: snapshot.orderId,
      url: snapshot.url,
      capturedAt: snapshot.capturedAt.toISOString(),
      createdAt: snapshot.createdAt.toISOString(),
    };
  }
}
