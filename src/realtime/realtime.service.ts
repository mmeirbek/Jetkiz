import { Injectable } from '@nestjs/common';
import { TelemetryRecord, UserRole } from '@prisma/client';
import { Server } from 'socket.io';
import type { AuthUser } from '../common/types/auth-user.type';
import { CarrierProfileRepository } from '../carrier/repositories/carrier-profile.repository';
import { PrismaService } from '../prisma/prisma.service';
import {
  RealtimeStatusEvent,
  RealtimeSubscription,
  RealtimeTelemetryEvent,
  realtimeRoom,
} from './ws-types';

@Injectable()
export class RealtimeService {
  private server: Server | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly carrierProfileRepository: CarrierProfileRepository,
  ) {}

  attachServer(server: Server) {
    this.server = server;
  }

  async canAccess(
    authUser: AuthUser,
    target: RealtimeSubscription,
  ): Promise<{ ok: true } | { ok: false; reason: string }> {
    if (authUser.role === UserRole.SUPERADMIN) {
      return { ok: true };
    }

    if (target.type === 'vehicle') {
      return this.canAccessVehicle(authUser, target.id);
    }
    if (target.type === 'order') {
      return this.canAccessOrder(authUser, target.id);
    }
    return this.canAccessDevice(authUser, target.id);
  }

  emitTelemetry(record: TelemetryRecord) {
    const payload: RealtimeTelemetryEvent = {
      deviceId: record.deviceId,
      vehicleId: record.vehicleId,
      orderId: record.orderId,
      temperature: record.temperature,
      humidity: record.humidity,
      battery: record.battery,
      speedKmh: record.speedKmh,
      lat: record.lat,
      lng: record.lng,
      eventTime: record.eventTime.toISOString(),
      createdAt: record.createdAt.toISOString(),
    };

    this.emitToRooms(
      [
        realtimeRoom('device', record.deviceId),
        ...(record.vehicleId
          ? [realtimeRoom('vehicle', record.vehicleId)]
          : []),
        ...(record.orderId ? [realtimeRoom('order', record.orderId)] : []),
      ],
      'telemetry',
      payload,
    );
  }

  emitStatus(event: RealtimeStatusEvent) {
    const payload: RealtimeStatusEvent = {
      deviceId: event.deviceId,
      vehicleId: event.vehicleId,
      status: event.status,
      battery: event.battery,
      eventTime: event.eventTime,
    };

    this.emitToRooms(
      [
        realtimeRoom('device', event.deviceId),
        ...(event.vehicleId ? [realtimeRoom('vehicle', event.vehicleId)] : []),
      ],
      'status',
      payload,
    );
  }

  private emitToRooms(
    rooms: string[],
    event: 'telemetry' | 'status',
    payload: RealtimeTelemetryEvent | RealtimeStatusEvent,
  ) {
    const server = this.server;
    if (!server) {
      return;
    }
    for (const room of new Set(rooms)) {
      server.to(room).emit(event, payload);
    }
  }

  private async canAccessVehicle(
    authUser: AuthUser,
    vehicleId: string,
  ): Promise<{ ok: true } | { ok: false; reason: string }> {
    const vehicle = await this.prisma.vehicle.findUnique({
      where: { id: vehicleId },
      select: { carrierId: true },
    });
    if (!vehicle) {
      return { ok: false, reason: 'Vehicle not found' };
    }
    if (!(await this.isOwnVehicle(authUser, vehicle.carrierId))) {
      return { ok: false, reason: 'Access denied' };
    }
    return { ok: true };
  }

  private async canAccessOrder(
    authUser: AuthUser,
    orderId: string,
  ): Promise<{ ok: true } | { ok: false; reason: string }> {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      select: { clientId: true, carrierId: true },
    });
    if (!order) {
      return { ok: false, reason: 'Order not found' };
    }
    if (order.clientId === authUser.id) {
      return { ok: true };
    }
    if (
      order.carrierId &&
      (await this.isOwnVehicle(authUser, order.carrierId))
    ) {
      return { ok: true };
    }
    return { ok: false, reason: 'Access denied' };
  }

  private async canAccessDevice(
    authUser: AuthUser,
    deviceId: string,
  ): Promise<{ ok: true } | { ok: false; reason: string }> {
    const device = await this.prisma.device.findUnique({
      where: { id: deviceId },
      select: { vehicleId: true },
    });
    if (!device) {
      return { ok: false, reason: 'Device not found' };
    }
    if (!device.vehicleId) {
      return { ok: false, reason: 'Device is not bound to a vehicle' };
    }
    return this.canAccessVehicle(authUser, device.vehicleId);
  }

  private async isOwnVehicle(
    authUser: AuthUser,
    carrierId: string | null,
  ): Promise<boolean> {
    if (!carrierId) {
      return false;
    }
    const profile = await this.carrierProfileRepository.findByUserId(
      authUser.id,
    );
    return profile?.id === carrierId;
  }
}
