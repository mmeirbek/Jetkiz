import { UserRole } from '@prisma/client';
import { RealtimeService } from './realtime.service';
import { REALTIME_NAMESPACE, realtimeRoom } from './ws-types';

describe('RealtimeService', () => {
  const prismaMock = {
    vehicle: { findUnique: jest.fn() },
    order: { findUnique: jest.fn() },
    device: { findUnique: jest.fn() },
  };

  const carrierProfileRepositoryMock = {
    findByUserId: jest.fn(),
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

  const carrier = {
    id: 'user-c',
    email: 'c@caspex.local',
    role: UserRole.CARRIER,
    firstName: 'C',
    lastName: 'R',
    phone: '+77000000001',
    isActive: true,
  };

  const client = {
    id: 'user-cl',
    email: 'cl@caspex.local',
    role: UserRole.CLIENT,
    firstName: 'CL',
    lastName: 'L',
    phone: '+77000000002',
    isActive: true,
  };

  const serverMock = {
    to: jest.fn().mockReturnValue({ emit: jest.fn() }),
  };

  const telemetryRecord = {
    id: 'tel-1',
    deviceId: 'device-1',
    vehicleId: 'vehicle-1',
    orderId: 'order-1',
    temperature: 22.5,
    humidity: 60,
    battery: 87,
    speedKmh: 42.5,
    lat: 45.3,
    lng: 51.1,
    eventTime: new Date('2026-08-19T12:00:00.000Z'),
    raw: {},
    createdAt: new Date('2026-08-19T12:00:00.000Z'),
  };

  let service: RealtimeService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new RealtimeService(
      prismaMock as never,
      carrierProfileRepositoryMock as never,
    );
  });

  it('stores the socket.io server reference', () => {
    service.attachServer(serverMock as never);
    service.emitTelemetry(telemetryRecord);
    expect(serverMock.to).toHaveBeenCalledWith(
      realtimeRoom('vehicle', 'vehicle-1'),
    );
  });

  it('allows superadmin to access any channel', async () => {
    const result = await service.canAccess(superAdmin, {
      type: 'order',
      id: 'whatever',
    });
    expect(result).toEqual({ ok: true });
  });

  it('allows a carrier to subscribe to their own vehicle', async () => {
    prismaMock.vehicle.findUnique.mockResolvedValue({
      id: 'vehicle-1',
      carrierId: 'profile-1',
    });
    carrierProfileRepositoryMock.findByUserId.mockResolvedValue({
      id: 'profile-1',
    });

    const result = await service.canAccess(carrier, {
      type: 'vehicle',
      id: 'vehicle-1',
    });
    expect(result).toEqual({ ok: true });
  });

  it('denies a carrier subscribing to a foreign vehicle', async () => {
    prismaMock.vehicle.findUnique.mockResolvedValue({
      id: 'vehicle-1',
      carrierId: 'profile-2',
    });
    carrierProfileRepositoryMock.findByUserId.mockResolvedValue({
      id: 'profile-1',
    });

    const result = await service.canAccess(carrier, {
      type: 'vehicle',
      id: 'vehicle-1',
    });
    expect(result).toEqual({ ok: false, reason: 'Access denied' });
  });

  it('allows a client to subscribe to their own order', async () => {
    prismaMock.order.findUnique.mockResolvedValue({
      id: 'order-1',
      clientId: client.id,
      carrierId: null,
    });

    const result = await service.canAccess(client, {
      type: 'order',
      id: 'order-1',
    });
    expect(result).toEqual({ ok: true });
  });

  it('denies a client subscribing to a foreign order', async () => {
    prismaMock.order.findUnique.mockResolvedValue({
      id: 'order-1',
      clientId: 'someone-else',
      carrierId: null,
    });

    const result = await service.canAccess(client, {
      type: 'order',
      id: 'order-1',
    });
    expect(result).toEqual({ ok: false, reason: 'Access denied' });
  });

  it('denies access to an unbound device', async () => {
    prismaMock.device.findUnique.mockResolvedValue({
      id: 'device-1',
      vehicleId: null,
    });

    const result = await service.canAccess(carrier, {
      type: 'device',
      id: 'device-1',
    });
    expect(result).toEqual({
      ok: false,
      reason: 'Device is not bound to a vehicle',
    });
  });

  it('emits telemetry to device, vehicle and order rooms', () => {
    service.attachServer(serverMock as never);
    service.emitTelemetry(telemetryRecord);

    expect(serverMock.to).toHaveBeenCalledWith(
      realtimeRoom('device', 'device-1'),
    );
    expect(serverMock.to).toHaveBeenCalledWith(
      realtimeRoom('vehicle', 'vehicle-1'),
    );
    expect(serverMock.to).toHaveBeenCalledWith(
      realtimeRoom('order', 'order-1'),
    );

    const emit = (
      serverMock.to.mock.results as unknown as Array<{
        value: { emit: jest.Mock };
      }>
    )[0].value.emit;
    expect(emit).toHaveBeenCalledWith('telemetry', {
      deviceId: 'device-1',
      vehicleId: 'vehicle-1',
      orderId: 'order-1',
      temperature: 22.5,
      humidity: 60,
      battery: 87,
      speedKmh: 42.5,
      lat: 45.3,
      lng: 51.1,
      eventTime: '2026-08-19T12:00:00.000Z',
      createdAt: '2026-08-19T12:00:00.000Z',
    });
  });

  it('emits status to device and vehicle rooms', () => {
    service.attachServer(serverMock as never);
    service.emitStatus({
      deviceId: 'device-1',
      vehicleId: 'vehicle-1',
      status: 'online',
      battery: 90,
      eventTime: '2026-08-19T12:00:00.000Z',
    });

    expect(serverMock.to).toHaveBeenCalledWith(
      realtimeRoom('device', 'device-1'),
    );
    expect(serverMock.to).toHaveBeenCalledWith(
      realtimeRoom('vehicle', 'vehicle-1'),
    );

    const emit = (
      serverMock.to.mock.results as unknown as Array<{
        value: { emit: jest.Mock };
      }>
    )[0].value.emit;
    expect(emit).toHaveBeenCalledWith('status', {
      deviceId: 'device-1',
      vehicleId: 'vehicle-1',
      status: 'online',
      battery: 90,
      eventTime: '2026-08-19T12:00:00.000Z',
    });
  });

  it('does not emit when the server is not attached', () => {
    service.emitTelemetry(telemetryRecord);
    expect(serverMock.to).not.toHaveBeenCalled();
  });

  it('exposes the realtime namespace constant', () => {
    expect(REALTIME_NAMESPACE).toBe('caspex');
  });
});
