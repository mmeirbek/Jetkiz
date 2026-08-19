import { NotFoundException } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { TelemetryBucket } from '../dto/telemetry-history-query.dto';
import { TelemetryService } from './telemetry.service';

describe('TelemetryService', () => {
  const telemetryRepositoryMock = {
    findLastByDevice: jest.fn(),
    findRangeByDevice: jest.fn(),
    findLastByVehicle: jest.fn(),
    findRangeByVehicle: jest.fn(),
    findLastByOrder: jest.fn(),
    findRangeByOrder: jest.fn(),
  };

  const carrierProfileRepositoryMock = {
    findByUserId: jest.fn(),
  };

  const prismaMock = {
    device: { findUnique: jest.fn() },
    vehicle: { findFirst: jest.fn() },
    order: { findUnique: jest.fn() },
  };

  const superAdmin = {
    id: 'user-sa',
    email: 'sa@caspex.local',
    role: UserRole.SUPERADMIN,
    firstName: 'S',
    lastName: 'A',
    phone: '+77000000000',
    isActive: true,
  };

  const client = {
    id: 'user-c',
    email: 'c@caspex.local',
    role: UserRole.CLIENT,
    firstName: 'C',
    lastName: 'L',
    phone: '+77000000001',
    isActive: true,
  };

  let service: TelemetryService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new TelemetryService(
      telemetryRepositoryMock as never,
      carrierProfileRepositoryMock as never,
      prismaMock as never,
    );
  });

  it('returns the latest telemetry for a vehicle', async () => {
    telemetryRepositoryMock.findLastByVehicle.mockResolvedValue({
      id: 'tel-1',
    });

    const result = await service.getVehicleLast(superAdmin, 'vehicle-1');

    expect(telemetryRepositoryMock.findLastByVehicle).toHaveBeenCalledWith(
      'vehicle-1',
    );
    expect(result.telemetry?.id).toBe('tel-1');
  });

  it('buckets vehicle history into hourly aggregates', async () => {
    const mk = (id: string, eventTime: Date, temperature: number) => ({
      id,
      deviceId: 'dev-1',
      vehicleId: 'vehicle-1',
      orderId: null,
      temperature,
      humidity: null,
      battery: null,
      speedKmh: null,
      lat: 45.3,
      lng: 51.1,
      eventTime,
      raw: {},
      createdAt: eventTime,
    });

    telemetryRepositoryMock.findRangeByVehicle.mockResolvedValue([
      mk('a', new Date('2026-08-19T10:00:00.000Z'), 20),
      mk('b', new Date('2026-08-19T10:30:00.000Z'), 22),
      mk('c', new Date('2026-08-19T10:59:00.000Z'), 24),
      mk('d', new Date('2026-08-19T11:00:00.000Z'), 30),
    ]);

    const result = await service.getVehicleHistory(superAdmin, 'vehicle-1', {
      bucket: TelemetryBucket.HOUR_1,
    });

    expect(result.points).toHaveLength(2);
    expect(result.points[0].time).toBe('2026-08-19T10:00:00.000Z');
    expect(result.points[0].count).toBe(3);
    expect(result.points[0].temperature).toEqual({
      avg: 22,
      min: 20,
      max: 24,
    });
    expect(result.points[1].count).toBe(1);
    expect(result.points[1].temperature).toEqual({ avg: 30, min: 30, max: 30 });
  });

  it('groups points without sensors into buckets with null aggregates', async () => {
    telemetryRepositoryMock.findRangeByDevice.mockResolvedValue([
      {
        id: 'tel-1',
        deviceId: 'dev-1',
        vehicleId: 'vehicle-1',
        orderId: null,
        temperature: null,
        humidity: null,
        battery: null,
        speedKmh: null,
        lat: 45.3,
        lng: 51.1,
        eventTime: new Date('2026-08-19T10:00:00.000Z'),
        raw: {},
        createdAt: new Date('2026-08-19T10:00:00.000Z'),
      },
    ]);
    prismaMock.device.findUnique.mockResolvedValue({
      id: 'dev-1',
      vehicleId: 'vehicle-1',
    });

    const result = await service.getDeviceHistory(superAdmin, 'dev-1', {
      bucket: TelemetryBucket.MIN_15,
    });

    expect(result.points[0].temperature).toBeNull();
    expect(result.points[0].lat).toBe(45.3);
  });

  it('allows a client to view their own order live telemetry', async () => {
    prismaMock.order.findUnique.mockResolvedValue({
      id: 'order-1',
      clientId: client.id,
      carrierId: null,
    });
    telemetryRepositoryMock.findLastByOrder.mockResolvedValue({ id: 'tel-9' });

    const result = await service.getOrderLive(client, 'order-1');

    expect(result.telemetry?.id).toBe('tel-9');
  });

  it('rejects telemetry for orders the user cannot see', async () => {
    prismaMock.order.findUnique.mockResolvedValue({
      id: 'order-1',
      clientId: 'someone-else',
      carrierId: null,
    });
    carrierProfileRepositoryMock.findByUserId.mockResolvedValue(null);

    await expect(service.getOrderLive(client, 'order-1')).rejects.toThrow(
      NotFoundException,
    );
  });

  it('rejects vehicle telemetry for a carrier that does not own the vehicle', async () => {
    const carrier = { ...client, role: UserRole.CARRIER };
    carrierProfileRepositoryMock.findByUserId.mockResolvedValue({
      id: 'carrier-1',
    });
    prismaMock.vehicle.findFirst.mockResolvedValue(null);

    await expect(
      service.getVehicleLast(carrier, 'vehicle-other'),
    ).rejects.toThrow(NotFoundException);
  });
});
