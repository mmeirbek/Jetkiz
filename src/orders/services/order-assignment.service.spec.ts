import { ConflictException, ForbiddenException } from '@nestjs/common';
import { OrderStatus, UserRole } from '@prisma/client';
import { OrderAssignmentService } from './order-assignment.service';

describe('OrderAssignmentService', () => {
  const ordersRepositoryMock = {
    findById: jest.fn(),
    update: jest.fn(),
  };
  const carrierProfileRepositoryMock = {
    findByUserId: jest.fn(),
  };
  const trackingServiceMock = {
    recordOrderEvent: jest.fn(),
  };
  const prismaMock = {
    vehicle: { findMany: jest.fn() },
    order: { findMany: jest.fn() },
  };

  const carrierUser = {
    id: 'carrier-user-1',
    email: 'carrier01@caspex.local',
    role: UserRole.CARRIER,
    firstName: 'Alibi',
    lastName: 'Samatov',
    phone: '+77010000002',
    isActive: true,
  };

  const carrierProfile = {
    id: 'carrier-1',
    userId: carrierUser.id,
    experienceYears: 5,
    transportType: 'ROAD',
    description: null,
    isApproved: true,
    createdAt: new Date('2026-06-11T10:00:00.000Z'),
    updatedAt: new Date('2026-06-11T10:00:00.000Z'),
  };

  const order = {
    id: 'order-1',
    clientId: 'client-1',
    carrierId: null,
    title: 'Transport cargo',
    cargoType: 'GENERAL',
    weight: 12,
    volume: 40,
    origin: 'Aktau',
    originCity: 'Aktau',
    originCountry: 'Kazakhstan',
    destination: 'Kuryk',
    destinationCity: 'Kuryk',
    destinationCountry: 'Kazakhstan',
    originLat: 43.6532,
    originLng: 51.1975,
    destinationLat: 43.1789,
    destinationLng: 51.6814,
    cargoPhotoUrl: 'https://cdn.example.com/orders/cargo-photo.jpg',
    productPhotoUrls: ['https://cdn.example.com/orders/photo-1.jpg'],
    comment: null,
    estimatedPrice: 100000,
    estimatedDeliveryTime: 8,
    estimatedCarrierSearchTime: 120,
    status: OrderStatus.SEARCHING,
    createdAt: new Date('2026-06-11T10:00:00.000Z'),
    updatedAt: new Date('2026-06-11T10:00:00.000Z'),
  };

  const vehicle = {
    id: 'vehicle-1',
    carrierId: carrierProfile.id,
    capacityTons: 20,
    cargoVolume: 82,
    lastSeenAt: new Date(),
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  let service: OrderAssignmentService;

  beforeEach(() => {
    jest.clearAllMocks();
    prismaMock.vehicle.findMany.mockResolvedValue([vehicle]);
    prismaMock.order.findMany.mockResolvedValue([]);
    service = new OrderAssignmentService(
      ordersRepositoryMock as never,
      carrierProfileRepositoryMock as never,
      trackingServiceMock as never,
      prismaMock as never,
    );
  });

  it('assigns available order to approved carrier', async () => {
    carrierProfileRepositoryMock.findByUserId.mockResolvedValue(carrierProfile);
    ordersRepositoryMock.findById.mockResolvedValue(order);
    ordersRepositoryMock.update.mockResolvedValue({
      ...order,
      carrierId: carrierProfile.id,
      status: OrderStatus.ASSIGNED,
    });

    const result = await service.assignToCurrentCarrier(carrierUser, order.id);

    expect(ordersRepositoryMock.update).toHaveBeenCalledWith(order.id, {
      carrier: { connect: { id: carrierProfile.id } },
      status: OrderStatus.ASSIGNED,
    });
    expect(trackingServiceMock.recordOrderEvent).toHaveBeenCalledWith({
      orderId: order.id,
      status: OrderStatus.ASSIGNED,
      location: order.origin,
    });
    expect(result.order.carrierId).toBe(carrierProfile.id);
    expect(result.order.status).toBe(OrderStatus.ASSIGNED);
  });

  it('allows assignment from searching state', async () => {
    carrierProfileRepositoryMock.findByUserId.mockResolvedValue(carrierProfile);
    ordersRepositoryMock.findById.mockResolvedValue({
      ...order,
      status: OrderStatus.SEARCHING,
    });
    ordersRepositoryMock.update.mockResolvedValue({
      ...order,
      carrierId: carrierProfile.id,
      status: OrderStatus.ASSIGNED,
    });

    const result = await service.assignToCurrentCarrier(carrierUser, order.id);

    expect(result.order.status).toBe(OrderStatus.ASSIGNED);
  });

  it('rejects assignment without approved carrier profile', async () => {
    carrierProfileRepositoryMock.findByUserId.mockResolvedValue({
      ...carrierProfile,
      isApproved: false,
    });

    await expect(
      service.assignToCurrentCarrier(carrierUser, order.id),
    ).rejects.toThrow(ForbiddenException);
  });

  it('rejects assignment when order is already assigned', async () => {
    carrierProfileRepositoryMock.findByUserId.mockResolvedValue(carrierProfile);
    ordersRepositoryMock.findById.mockResolvedValue({
      ...order,
      carrierId: 'another-carrier',
    });

    await expect(
      service.assignToCurrentCarrier(carrierUser, order.id),
    ).rejects.toThrow(ConflictException);
  });

  it('rejects assignment when order exceeds remaining vehicle capacity', async () => {
    carrierProfileRepositoryMock.findByUserId.mockResolvedValue(carrierProfile);
    ordersRepositoryMock.findById.mockResolvedValue(order);
    prismaMock.vehicle.findMany.mockResolvedValue([
      { ...vehicle, capacityTons: 0.01 },
    ]);

    await expect(
      service.assignToCurrentCarrier(carrierUser, order.id),
    ).rejects.toThrow(/Not enough free capacity/);
    expect(ordersRepositoryMock.update).not.toHaveBeenCalled();
  });

  it('rejects assignment when carrier has no registered vehicle', async () => {
    carrierProfileRepositoryMock.findByUserId.mockResolvedValue(carrierProfile);
    ordersRepositoryMock.findById.mockResolvedValue(order);
    prismaMock.vehicle.findMany.mockResolvedValue([]);

    await expect(
      service.assignToCurrentCarrier(carrierUser, order.id),
    ).rejects.toThrow(/no registered vehicle/i);
    expect(ordersRepositoryMock.update).not.toHaveBeenCalled();
  });

  it('reports free capacity after a successful assignment', async () => {
    carrierProfileRepositoryMock.findByUserId.mockResolvedValue(carrierProfile);
    ordersRepositoryMock.findById.mockResolvedValue(order);
    prismaMock.order.findMany.mockResolvedValue([{ weight: 500, volume: 10 }]);
    ordersRepositoryMock.update.mockResolvedValue({
      ...order,
      carrierId: carrierProfile.id,
      status: OrderStatus.ASSIGNED,
    });

    const result = await service.assignToCurrentCarrier(carrierUser, order.id);

    expect(result.order.status).toBe(OrderStatus.ASSIGNED);
    expect(result.capacityTons).toBe(20);
    expect(result.freeCapacityTons).toBe(19.5);
  });
});
