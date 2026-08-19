import { NotFoundException } from '@nestjs/common';
import { OrderStatus } from '@prisma/client';
import { SuperadminOrdersService } from './superadmin-orders.service';

describe('SuperadminOrdersService', () => {
  const prismaMock = {
    order: {
      findMany: jest.fn(),
      count: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
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
    status: OrderStatus.NEW,
    createdAt: new Date('2026-06-11T10:00:00.000Z'),
    updatedAt: new Date('2026-06-11T10:00:00.000Z'),
    client: {
      email: 'client01@caspex.local',
      firstName: 'Ayan',
      lastName: 'Serikov',
    },
    carrier: null,
  };

  let service: SuperadminOrdersService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new SuperadminOrdersService(prismaMock as never);
  });

  it('lists orders with pagination meta', async () => {
    prismaMock.order.findMany.mockResolvedValue([order]);
    prismaMock.order.count.mockResolvedValue(1);

    const result = await service.list({
      page: 1,
      limit: 25,
      search: 'aktau',
    });

    expect(prismaMock.order.findMany).toHaveBeenCalled();
    expect(result.orders).toHaveLength(1);
    expect(result.orders[0].clientEmail).toBe('client01@caspex.local');
    expect(result.meta.total).toBe(1);
  });

  it('updates order status and carrier', async () => {
    prismaMock.order.findUnique.mockResolvedValue(order);
    prismaMock.order.update.mockResolvedValue({
      ...order,
      carrierId: 'carrier-1',
      status: OrderStatus.ASSIGNED,
      carrier: {
        user: {
          email: 'carrier01@caspex.local',
          firstName: 'Alibi',
          lastName: 'Samatov',
        },
      },
    });

    const result = await service.update(order.id, {
      carrierId: 'carrier-1',
      status: OrderStatus.ASSIGNED,
    });

    expect(prismaMock.order.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: order.id },
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment -- jest.objectContaining returns `any`
        data: expect.objectContaining({
          status: OrderStatus.ASSIGNED,
          carrier: { connect: { id: 'carrier-1' } },
        }),
      }),
    );
    expect(result.order.carrierEmail).toBe('carrier01@caspex.local');
  });

  it('throws not found for missing order', async () => {
    prismaMock.order.findUnique.mockResolvedValue(null);

    await expect(service.getById('missing-order')).rejects.toThrow(
      NotFoundException,
    );
  });
});
