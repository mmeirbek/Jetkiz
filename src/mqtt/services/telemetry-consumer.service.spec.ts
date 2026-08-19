import { DeviceStatus, OrderStatus } from '@prisma/client';
import { TelemetryConsumerService } from './telemetry-consumer.service';

describe('TelemetryConsumerService', () => {
  const deviceRepositoryMock = {
    findActiveById: jest.fn(),
    update: jest.fn(),
  };

  const deviceSecretServiceMock = {
    verifySecret: jest.fn(),
  };

  const telemetryRepositoryMock = {
    create: jest.fn(),
  };

  const prismaMock = {
    order: { findFirst: jest.fn() },
    vehicle: { update: jest.fn() },
  };

  const realtimeServiceMock = {
    emitTelemetry: jest.fn(),
    emitStatus: jest.fn(),
  };

  const activeDevice = {
    id: 'device-1',
    name: 'GPS tracker',
    secretHash: 'argon2-hash',
    status: DeviceStatus.ACTIVE,
    vehicleId: 'vehicle-1',
    lastLat: null,
    lastLng: null,
    lastSeenAt: null,
    createdAt: new Date('2026-08-19T09:00:00.000Z'),
  };

  const telemetryRecord = {
    id: 'tel-1',
    deviceId: 'device-1',
    vehicleId: 'vehicle-1',
    orderId: 'order-1',
    temperature: 25,
    humidity: 60,
    battery: 90,
    speedKmh: 70,
    lat: 45.3,
    lng: 51.1,
    eventTime: new Date('2026-08-19T10:00:00.000Z'),
    raw: {},
    createdAt: new Date('2026-08-19T10:00:00.000Z'),
  };

  let service: TelemetryConsumerService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new TelemetryConsumerService(
      deviceRepositoryMock as never,
      deviceSecretServiceMock as never,
      telemetryRepositoryMock as never,
      prismaMock as never,
      realtimeServiceMock as never,
    );
  });

  const payload = (overrides: Record<string, unknown> = {}) =>
    JSON.stringify({
      temperature: 25,
      humidity: 60,
      battery: 90,
      speed: 70,
      lat: 45.3,
      lng: 51.1,
      event_time: '2026-08-19T10:00:00.000Z',
      ...overrides,
    });

  it('rejects telemetry from unknown or inactive devices', async () => {
    deviceRepositoryMock.findActiveById.mockResolvedValue(null);

    await service.handleTelemetry('ghost', payload());

    expect(telemetryRepositoryMock.create).not.toHaveBeenCalled();
  });

  it('rejects malformed JSON', async () => {
    deviceRepositoryMock.findActiveById.mockResolvedValue(activeDevice);

    await service.handleTelemetry('device-1', 'not-json');

    expect(telemetryRepositoryMock.create).not.toHaveBeenCalled();
  });

  it('rejects telemetry without valid coordinates', async () => {
    deviceRepositoryMock.findActiveById.mockResolvedValue(activeDevice);

    await service.handleTelemetry('device-1', payload({ lat: 'nope' }));

    expect(telemetryRepositoryMock.create).not.toHaveBeenCalled();
  });

  it('rejects telemetry with an invalid secret', async () => {
    deviceRepositoryMock.findActiveById.mockResolvedValue(activeDevice);
    deviceSecretServiceMock.verifySecret.mockResolvedValue(false);

    await service.handleTelemetry('device-1', payload({ secret: 'wrong' }));

    expect(deviceSecretServiceMock.verifySecret).toHaveBeenCalledWith(
      'wrong',
      activeDevice.secretHash,
    );
    expect(telemetryRepositoryMock.create).not.toHaveBeenCalled();
  });

  it('persists telemetry and updates device and vehicle positions', async () => {
    deviceRepositoryMock.findActiveById.mockResolvedValue(activeDevice);
    deviceSecretServiceMock.verifySecret.mockResolvedValue(true);
    telemetryRepositoryMock.create.mockResolvedValue(telemetryRecord);
    prismaMock.order.findFirst.mockResolvedValue({ id: 'order-1' });
    prismaMock.vehicle.update.mockResolvedValue({});

    await service.handleTelemetry('device-1', payload({ secret: 'valid' }));

    expect(telemetryRepositoryMock.create).toHaveBeenCalledWith(
      expect.objectContaining({
        deviceId: 'device-1',
        vehicleId: 'vehicle-1',
        orderId: 'order-1',
        temperature: 25,
        humidity: 60,
        battery: 90,
        speedKmh: 70,
        lat: 45.3,
        lng: 51.1,
      }),
    );
    expect(realtimeServiceMock.emitTelemetry).toHaveBeenCalledWith(
      telemetryRecord,
    );
    expect(deviceRepositoryMock.update).toHaveBeenCalledWith(
      'device-1',
      expect.objectContaining({
        lastLat: 45.3,
        lastLng: 51.1,
      }),
    );
    const vehicleCall = (
      prismaMock.vehicle.update.mock.calls as unknown as Array<
        [{ where: { id: string }; data: { lastLat: number; lastLng: number } }]
      >
    )[0][0];
    expect(vehicleCall.where.id).toBe('vehicle-1');
    expect(vehicleCall.data.lastLat).toBe(45.3);
    expect(vehicleCall.data.lastLng).toBe(51.1);
    expect(prismaMock.order.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          assignedVehicleId: 'vehicle-1',
          status: {
            in: [
              OrderStatus.ASSIGNED,
              OrderStatus.PICKED_UP,
              OrderStatus.IN_TRANSIT,
              OrderStatus.AT_CHECKPOINT,
            ],
          },
        },
      }),
    );
  });

  it('does not leak the secret into stored raw payload', async () => {
    deviceRepositoryMock.findActiveById.mockResolvedValue(activeDevice);
    deviceSecretServiceMock.verifySecret.mockResolvedValue(true);
    telemetryRepositoryMock.create.mockResolvedValue(telemetryRecord);
    prismaMock.order.findFirst.mockResolvedValue(null);

    await service.handleTelemetry('device-1', payload({ secret: 'valid' }));

    const createCall = (
      telemetryRepositoryMock.create.mock.calls as unknown as Array<
        [{ raw: Record<string, unknown> }]
      >
    )[0][0];
    expect(createCall.raw).not.toHaveProperty('secret');
  });

  it('resolves null orderId when no active order exists', async () => {
    deviceRepositoryMock.findActiveById.mockResolvedValue(activeDevice);
    deviceSecretServiceMock.verifySecret.mockResolvedValue(true);
    telemetryRepositoryMock.create.mockResolvedValue(telemetryRecord);
    prismaMock.order.findFirst.mockResolvedValue(null);

    await service.handleTelemetry('device-1', payload({ secret: 'valid' }));

    expect(telemetryRepositoryMock.create).toHaveBeenCalledWith(
      expect.objectContaining({ orderId: null }),
    );
  });

  it('skips secret verification for already trusted devices', async () => {
    deviceRepositoryMock.findActiveById.mockResolvedValue(activeDevice);
    deviceSecretServiceMock.verifySecret.mockResolvedValue(true);
    telemetryRepositoryMock.create.mockResolvedValue(telemetryRecord);
    prismaMock.order.findFirst.mockResolvedValue(null);

    await service.handleTelemetry('device-1', payload({ secret: 'valid' }));
    await service.handleTelemetry('device-1', payload());

    expect(deviceSecretServiceMock.verifySecret).toHaveBeenCalledTimes(1);
    expect(telemetryRepositoryMock.create).toHaveBeenCalledTimes(2);
  });

  it('updates lastSeenAt on status messages', async () => {
    deviceRepositoryMock.findActiveById.mockResolvedValue(activeDevice);

    await service.handleStatus(
      'device-1',
      JSON.stringify({ status: 'online', battery: 90 }),
    );

    const deviceCall = (
      deviceRepositoryMock.update.mock.calls as unknown as Array<
        [string, { lastSeenAt: Date }]
      >
    )[0];
    expect(deviceCall[0]).toBe('device-1');
    expect(deviceCall[1].lastSeenAt).toBeInstanceOf(Date);

    expect(realtimeServiceMock.emitStatus).toHaveBeenCalledWith(
      expect.objectContaining({
        deviceId: 'device-1',
        vehicleId: 'vehicle-1',
        status: 'online',
        battery: 90,
      }),
    );
  });
});
