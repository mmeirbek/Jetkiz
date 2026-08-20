import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { OrderStatus, UserRole } from '@prisma/client';
import { OrdersService } from './orders.service';

describe('OrdersService', () => {
  const ordersRepositoryMock = {
    create: jest.fn(),
    findById: jest.fn(),
    findManyForUser: jest.fn(),
    findAvailable: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  };
  const carrierProfileRepositoryMock = {
    findByUserId: jest.fn(),
  };
  const trackingServiceMock = {
    recordOrderEvent: jest.fn(),
  };
  const settlementsServiceMock = {
    findOne: jest.fn(),
  };
  const routesServiceMock = {
    calculateForOrder: jest.fn(),
  };

  const clientUser = {
    id: 'client-1',
    email: 'client01@caspex.local',
    role: UserRole.CLIENT,
    firstName: 'Ayan',
    lastName: 'Serikov',
    phone: '+77010000001',
    isActive: true,
  };

  const order = {
    id: 'order-1',
    clientId: clientUser.id,
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

  let service: OrdersService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new OrdersService(
      ordersRepositoryMock as never,
      carrierProfileRepositoryMock as never,
      trackingServiceMock as never,
      settlementsServiceMock as never,
      routesServiceMock as never,
    );
  });

  it('creates order for current client', async () => {
    ordersRepositoryMock.create.mockResolvedValue(order);
    routesServiceMock.calculateForOrder.mockResolvedValue(null);

    const result = await service.create(clientUser, {
      title: 'Transport cargo',
      cargoType: 'GENERAL',
      weight: 12,
      volume: 40,
      origin: 'Aktau',
      destination: 'Kuryk',
      originLat: 43.6532,
      originLng: 51.1975,
      destinationLat: 43.1789,
      destinationLng: 51.6814,
      estimatedPrice: 100000,
      estimatedDeliveryTime: 8,
      estimatedCarrierSearchTime: 120,
    });

    expect(ordersRepositoryMock.create).toHaveBeenCalledWith(
      expect.objectContaining({
        clientId: clientUser.id,
        status: OrderStatus.SEARCHING,
      }),
    );
    expect(trackingServiceMock.recordOrderEvent).toHaveBeenCalledWith({
      orderId: order.id,
      status: OrderStatus.SEARCHING,
      location: order.origin,
    });
    expect(result.order.id).toBe(order.id);
    expect(result.routeCalculated).toBe(false);
  });

  it('resolves settlements and returns the calculated route', async () => {
    const aktau = {
      id: 'aktau',
      name: 'Aktau',
      latitude: 43.65,
      longitude: 51.16,
    };
    const kuryk = {
      id: 'kuryk',
      name: 'Kuryk',
      latitude: 42.49,
      longitude: 51.68,
    };
    const createdOrder = { ...order, origin: 'Aktau', destination: 'Kuryk' };
    const routeRecord = {
      id: 'route-1',
      orderId: 'order-1',
      distanceKm: 141.4,
      durationMinutes: 141,
      geometry: { type: 'LineString', coordinates: [] },
    };

    settlementsServiceMock.findOne.mockImplementation((id: string) =>
      Promise.resolve({ settlement: id === 'aktau' ? aktau : kuryk }),
    );
    ordersRepositoryMock.create.mockResolvedValue(createdOrder);
    ordersRepositoryMock.update.mockResolvedValue({
      ...createdOrder,
      estimatedDeliveryTime: 3,
    });
    routesServiceMock.calculateForOrder.mockResolvedValue(routeRecord);

    const result = await service.create(clientUser, {
      title: 'Transport cargo',
      cargoType: 'GENERAL',
      weight: 12,
      volume: 40,
      originSettlementId: 'aktau',
      destinationSettlementId: 'kuryk',
    });

    expect(ordersRepositoryMock.create).toHaveBeenCalledWith(
      expect.objectContaining({
        originSettlementId: 'aktau',
        destinationSettlementId: 'kuryk',
        origin: 'Aktau',
        destination: 'Kuryk',
        originLat: 43.65,
        originLng: 51.16,
        destinationLat: 42.49,
        destinationLng: 51.68,
      }),
    );
    expect(routesServiceMock.calculateForOrder).toHaveBeenCalledWith(
      createdOrder,
    );
    expect(ordersRepositoryMock.update).toHaveBeenCalledWith('order-1', {
      estimatedDeliveryTime: 3,
    });
    expect(result.routeCalculated).toBe(true);
    expect(result.route?.distanceKm).toBe(141.4);
  });

  it('rejects admin order creation', async () => {
    await expect(
      service.create(
        {
          ...clientUser,
          role: UserRole.ADMIN,
        },
        {
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
        },
      ),
    ).rejects.toThrow(ForbiddenException);
  });

  it('hides unrelated orders', async () => {
    ordersRepositoryMock.findById.mockResolvedValue({
      ...order,
      clientId: 'another-client',
    });
    carrierProfileRepositoryMock.findByUserId.mockResolvedValue(null);

    await expect(service.getById(clientUser, order.id)).rejects.toThrow(
      NotFoundException,
    );
  });
});
