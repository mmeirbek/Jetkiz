import {
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, UserRole } from '@prisma/client';
import { DevicesService } from './devices.service';

describe('DevicesService', () => {
  const deviceRepositoryMock = {
    create: jest.fn(),
    findById: jest.fn(),
    findAll: jest.fn(),
    findByCarrierProfile: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  };

  const deviceSecretServiceMock = {
    generateSecret: jest.fn(),
    hashSecret: jest.fn(),
  };

  const carrierProfileRepositoryMock = {
    findByUserId: jest.fn(),
  };

  const prismaMock = {
    vehicle: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
    },
  };

  const carrierUser = {
    id: 'user-1',
    email: 'carrier@caspex.local',
    role: UserRole.CARRIER,
    firstName: 'A',
    lastName: 'B',
    phone: '+77000000000',
    isActive: true,
  };

  const superAdminUser = {
    id: 'user-2',
    email: 'admin@caspex.local',
    role: UserRole.SUPERADMIN,
    firstName: 'S',
    lastName: 'A',
    phone: '+77000000001',
    isActive: true,
  };

  const carrierProfile = {
    id: 'carrier-1',
    userId: 'user-1',
    experienceYears: 5,
    transportType: 'ROAD',
    description: null,
    isApproved: true,
    rating: null,
    completedOrders: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const device = {
    id: 'device-1',
    name: 'GPS tracker',
    secretHash: 'hashed',
    status: 'ACTIVE' as const,
    vehicleId: null,
    lastLat: null,
    lastLng: null,
    lastSeenAt: null,
    createdAt: new Date(),
  };

  let service: DevicesService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new DevicesService(
      deviceRepositoryMock as never,
      deviceSecretServiceMock as never,
      carrierProfileRepositoryMock as never,
      prismaMock as never,
    );
    deviceSecretServiceMock.generateSecret.mockReturnValue('super-secret');
    deviceSecretServiceMock.hashSecret.mockResolvedValue('hashed-secret');
  });

  it('creates a device for a carrier and returns the secret once', async () => {
    carrierProfileRepositoryMock.findByUserId.mockResolvedValue(carrierProfile);
    prismaMock.vehicle.findFirst.mockResolvedValue({ id: 'vehicle-1' });
    deviceRepositoryMock.create.mockResolvedValue(device);

    const result = await service.create(carrierUser, {
      name: 'GPS tracker',
      vehicleId: 'vehicle-1',
    });

    expect(prismaMock.vehicle.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'vehicle-1', carrierId: carrierProfile.id },
      }),
    );
    expect(deviceRepositoryMock.create).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'GPS tracker',
        secretHash: 'hashed-secret',
        vehicleId: 'vehicle-1',
      }),
    );
    expect(result).toEqual({ device, secret: 'super-secret' });
  });

  it('creates an unbound device without vehicle checks', async () => {
    deviceRepositoryMock.create.mockResolvedValue(device);

    const result = await service.create(superAdminUser, {
      name: 'GPS tracker',
    });

    expect(deviceRepositoryMock.create).toHaveBeenCalledWith(
      expect.objectContaining({ vehicleId: null }),
    );
    expect(result.secret).toBe('super-secret');
  });

  it('rejects device creation for a carrier without a profile', async () => {
    carrierProfileRepositoryMock.findByUserId.mockResolvedValue(null);

    await expect(
      service.create(carrierUser, {
        name: 'GPS tracker',
        vehicleId: 'vehicle-1',
      }),
    ).rejects.toThrow(NotFoundException);
  });

  it('rejects device creation for a vehicle the carrier does not own', async () => {
    carrierProfileRepositoryMock.findByUserId.mockResolvedValue(carrierProfile);
    prismaMock.vehicle.findFirst.mockResolvedValue(null);

    await expect(
      service.create(carrierUser, {
        name: 'GPS tracker',
        vehicleId: 'vehicle-other',
      }),
    ).rejects.toThrow(NotFoundException);
  });

  it('maps vehicle already bound to a conflict', async () => {
    deviceRepositoryMock.create.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('duplicate', {
        code: 'P2002',
        clientVersion: 'test',
      }),
    );

    await expect(
      service.create(superAdminUser, { name: 'GPS tracker' }),
    ).rejects.toThrow(ConflictException);
  });

  it('lists only own carrier devices for a carrier', async () => {
    carrierProfileRepositoryMock.findByUserId.mockResolvedValue(carrierProfile);
    deviceRepositoryMock.findByCarrierProfile.mockResolvedValue([device]);

    const result = await service.list(carrierUser);

    expect(deviceRepositoryMock.findByCarrierProfile).toHaveBeenCalledWith(
      carrierProfile.id,
    );
    expect(result.devices).toHaveLength(1);
  });

  it('lists all devices for a superadmin', async () => {
    deviceRepositoryMock.findAll.mockResolvedValue([device]);

    const result = await service.list(superAdminUser);

    expect(deviceRepositoryMock.findAll).toHaveBeenCalled();
    expect(result.devices).toHaveLength(1);
  });

  it('binds a device to a carrier-owned vehicle', async () => {
    deviceRepositoryMock.findById.mockResolvedValue(device);
    carrierProfileRepositoryMock.findByUserId.mockResolvedValue(carrierProfile);
    prismaMock.vehicle.findFirst.mockResolvedValue({ id: 'vehicle-1' });
    deviceRepositoryMock.update.mockResolvedValue({
      ...device,
      vehicleId: 'vehicle-1',
    });

    const result = await service.bindVehicle(carrierUser, device.id, {
      vehicleId: 'vehicle-1',
    });

    expect(deviceRepositoryMock.update).toHaveBeenCalledWith(device.id, {
      vehicleId: 'vehicle-1',
    });
    expect(result.device.vehicleId).toBe('vehicle-1');
  });

  it('unbinds a device when vehicleId is null', async () => {
    deviceRepositoryMock.findById.mockResolvedValue(device);
    carrierProfileRepositoryMock.findByUserId.mockResolvedValue(carrierProfile);
    deviceRepositoryMock.update.mockResolvedValue({
      ...device,
      vehicleId: null,
    });

    const result = await service.bindVehicle(carrierUser, device.id, {
      vehicleId: null,
    });

    expect(deviceRepositoryMock.update).toHaveBeenCalledWith(device.id, {
      vehicleId: null,
    });
    expect(result.device.vehicleId).toBeNull();
  });

  it('rotates the device secret', async () => {
    deviceRepositoryMock.findById.mockResolvedValue(device);
    deviceRepositoryMock.update.mockResolvedValue({
      ...device,
      secretHash: 'new-hash',
    });

    const result = await service.rotateSecret(superAdminUser, device.id);

    expect(deviceRepositoryMock.update).toHaveBeenCalledWith(device.id, {
      secretHash: 'hashed-secret',
    });
    expect(result.secret).toBe('super-secret');
  });

  it('deletes a device', async () => {
    deviceRepositoryMock.findById.mockResolvedValue(device);
    deviceRepositoryMock.delete.mockResolvedValue(device);

    const result = await service.remove(superAdminUser, device.id);

    expect(deviceRepositoryMock.delete).toHaveBeenCalledWith(device.id);
    expect(result.device.id).toBe(device.id);
  });

  it('throws not found for missing device', async () => {
    deviceRepositoryMock.findById.mockResolvedValue(null);

    await expect(
      service.rotateSecret(superAdminUser, 'missing'),
    ).rejects.toThrow(NotFoundException);
  });

  it('throws forbidden for unsupported roles', async () => {
    const clientUser = { ...superAdminUser, role: UserRole.CLIENT };

    await expect(service.create(clientUser, { name: 'x' })).rejects.toThrow(
      ForbiddenException,
    );
  });
});
