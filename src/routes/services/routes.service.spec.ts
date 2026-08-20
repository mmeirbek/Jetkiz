import {
  BadGatewayException,
  BadRequestException,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { AxiosError } from 'axios';
import { OrderStatus, UserRole } from '@prisma/client';
import { of, throwError } from 'rxjs';
import { RoutesService, haversineKm } from './routes.service';

describe('RoutesService', () => {
  const httpServiceMock = {
    post: jest.fn(),
  };
  const prismaMock = {
    order: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
    },
    vehicle: {
      findMany: jest.fn(),
    },
  };
  const carrierProfileRepositoryMock = {
    findByUserId: jest.fn(),
  };
  const routesRepositoryMock = {
    create: jest.fn(),
  };
  const vroomServiceMock = {
    isConfigured: jest.fn(),
    optimize: jest.fn(),
    decodeRoute: jest.fn(),
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

  const carrierVehicle = {
    id: 'vehicle-1',
    carrierId: carrierProfile.id,
    type: 'truck',
    brand: 'Volvo',
    model: 'FH16',
    year: 2022,
    plateNumber: '001AAA01',
    capacityTons: 20,
    cargoVolume: 82,
    lastLat: 43.65,
    lastLng: 51.16,
    lastSeenAt: new Date(),
    createdAt: new Date('2026-06-11T10:00:00.000Z'),
    updatedAt: new Date('2026-06-11T10:00:00.000Z'),
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
    cargoPhotoUrl: null,
    productPhotoUrls: [],
    comment: null,
    estimatedPrice: 100000,
    estimatedDeliveryTime: 8,
    estimatedCarrierSearchTime: 120,
    status: OrderStatus.SEARCHING,
    createdAt: new Date('2026-06-11T10:00:00.000Z'),
    updatedAt: new Date('2026-06-11T10:00:00.000Z'),
  };

  let service: RoutesService;
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    jest.clearAllMocks();
    originalEnv = process.env;
    process.env = {
      ...originalEnv,
      OPENROUTESERVICE_API_KEY: 'test-ors-key',
      OPENROUTESERVICE_BASE_URL: 'https://api.openrouteservice.org',
    };

    service = new RoutesService(
      httpServiceMock as never,
      prismaMock as never,
      carrierProfileRepositoryMock as never,
      routesRepositoryMock as never,
      vroomServiceMock as never,
    );
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('calculates route from explicit coordinates and stores it', async () => {
    httpServiceMock.post.mockReturnValue(
      of({
        data: {
          features: [
            {
              geometry: {
                type: 'LineString',
                coordinates: [
                  [51.17, 43.65],
                  [49.89, 40.37],
                ],
              },
              properties: {
                summary: {
                  distance: 682120,
                  duration: 44432,
                },
              },
            },
          ],
        },
      }),
    );
    routesRepositoryMock.create.mockResolvedValue({
      id: 'route-1',
      orderId: null,
      distanceKm: 682.12,
      durationMinutes: 740.53,
      geometry: {
        type: 'LineString',
        coordinates: [
          [51.17, 43.65],
          [49.89, 40.37],
        ],
      },
      createdAt: new Date('2026-06-11T12:00:00.000Z'),
    });

    const result = await service.calculate(clientUser, {
      startLat: 43.65,
      startLng: 51.17,
      endLat: 40.37,
      endLng: 49.89,
    });

    expect(httpServiceMock.post).toHaveBeenCalled();
    expect(routesRepositoryMock.create).toHaveBeenCalledWith({
      orderId: null,
      distanceKm: 682.12,
      durationMinutes: 740.53,
      geometry: {
        type: 'LineString',
        coordinates: [
          [51.17, 43.65],
          [49.89, 40.37],
        ],
      },
    });
    expect(result.distanceKm).toBe(682.12);
    expect(result.durationMinutes).toBe(740.53);
  });

  it('uses order coordinates when orderId is provided', async () => {
    prismaMock.order.findUnique.mockResolvedValue(order);
    httpServiceMock.post.mockReturnValue(
      of({
        data: {
          features: [
            {
              geometry: {
                type: 'LineString',
                coordinates: [
                  [order.originLng, order.originLat],
                  [order.destinationLng, order.destinationLat],
                ],
              },
              properties: {
                summary: {
                  distance: 1000,
                  duration: 600,
                },
              },
            },
          ],
        },
      }),
    );
    routesRepositoryMock.create.mockResolvedValue({
      id: 'route-2',
      orderId: order.id,
      distanceKm: 1,
      durationMinutes: 10,
      geometry: {
        type: 'LineString',
        coordinates: [
          [order.originLng, order.originLat],
          [order.destinationLng, order.destinationLat],
        ],
      },
      createdAt: new Date('2026-06-11T12:00:00.000Z'),
    });

    const result = await service.calculate(clientUser, {
      orderId: order.id,
    });

    expect(prismaMock.order.findUnique).toHaveBeenCalledWith({
      where: { id: order.id },
    });
    expect(result.orderId).toBe(order.id);
  });

  it('rejects missing coordinates when neither order nor coordinates are usable', async () => {
    await expect(service.calculate(clientUser, {})).rejects.toThrow(
      BadRequestException,
    );
  });

  it('throws not found when order does not exist', async () => {
    prismaMock.order.findUnique.mockResolvedValue(null);

    await expect(
      service.calculate(clientUser, {
        orderId: 'missing-order',
      }),
    ).rejects.toThrow(NotFoundException);
  });

  it('throws when ors request fails', async () => {
    httpServiceMock.post.mockReturnValue(
      throwError(() => new Error('network failed')),
    );

    await expect(
      service.calculate(clientUser, {
        startLat: 43.65,
        startLng: 51.17,
        endLat: 40.37,
        endLng: 49.89,
      }),
    ).rejects.toThrow(BadGatewayException);
  });

  it('returns bad request when ors reports a non-routable point', async () => {
    httpServiceMock.post.mockReturnValue(
      throwError(
        () =>
          new AxiosError(
            'Request failed with status code 404',
            'ERR_BAD_REQUEST',
            undefined,
            undefined,
            {
              status: 404,
              statusText: 'Not Found',
              headers: {},
              config: undefined as never,
              data: {
                error: {
                  code: 2010,
                  message:
                    'Could not find routable point within a radius of 350.0 meters',
                },
              },
            },
          ),
      ),
    );

    await expect(
      service.calculate(clientUser, {
        startLat: 43.65,
        startLng: 51.17,
        endLat: 40.37,
        endLng: 49.89,
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('returns explicit bad gateway when ors rejects the api key', async () => {
    httpServiceMock.post.mockReturnValue(
      throwError(
        () =>
          new AxiosError(
            'Request failed with status code 401',
            'ERR_BAD_REQUEST',
            undefined,
            undefined,
            {
              status: 401,
              statusText: 'Unauthorized',
              headers: {},
              config: undefined as never,
              data: {
                error: 'Authorization field missing',
              },
            },
          ),
      ),
    );

    await expect(
      service.calculate(clientUser, {
        startLat: 43.65,
        startLng: 51.17,
        endLat: 40.37,
        endLng: 49.89,
      }),
    ).rejects.toThrow(BadGatewayException);
  });

  it('throws when ors response payload is invalid', async () => {
    httpServiceMock.post.mockReturnValue(
      of({
        data: {
          features: [],
        },
      }),
    );

    await expect(
      service.calculate(clientUser, {
        startLat: 43.65,
        startLng: 51.17,
        endLat: 40.37,
        endLng: 49.89,
      }),
    ).rejects.toThrow(BadGatewayException);
  });

  it('throws when api key is missing', async () => {
    delete process.env.OPENROUTESERVICE_API_KEY;

    await expect(
      service.calculate(clientUser, {
        startLat: 43.65,
        startLng: 51.17,
        endLat: 40.37,
        endLng: 49.89,
      }),
    ).rejects.toThrow(InternalServerErrorException);
  });

  it('routes through VROOM when VROOM_URL is configured', async () => {
    vroomServiceMock.isConfigured.mockReturnValue(true);
    vroomServiceMock.optimize.mockResolvedValue({
      code: 0,
      routes: [
        {
          vehicle: 1,
          distance: 682120,
          duration: 44432,
          steps: [],
        },
      ],
    });
    vroomServiceMock.decodeRoute.mockReturnValue({
      distanceKm: 682.12,
      durationMinutes: 740.53,
      coordinates: [
        [51.17, 43.65],
        [49.89, 40.37],
      ],
    });
    routesRepositoryMock.create.mockResolvedValue({
      id: 'route-vroom',
      orderId: null,
      distanceKm: 682.12,
      durationMinutes: 740.53,
      geometry: {
        type: 'LineString',
        coordinates: [
          [51.17, 43.65],
          [49.89, 40.37],
        ],
      },
      createdAt: new Date('2026-06-11T12:00:00.000Z'),
    });

    const result = await service.calculate(clientUser, {
      startLat: 43.65,
      startLng: 51.17,
      endLat: 40.37,
      endLng: 49.89,
    });

    expect(httpServiceMock.post).not.toHaveBeenCalled();
    expect(vroomServiceMock.optimize).toHaveBeenCalledWith({
      jobs: [{ id: 1, location: [49.89, 40.37] }],
      vehicles: [
        {
          id: 1,
          profile: 'driving-car',
          start: [51.17, 43.65],
          end: [49.89, 40.37],
        },
      ],
      options: { g: true },
    });
    expect(result.routeId).toBe('route-vroom');
    expect(result.distanceKm).toBe(682.12);
  });

  it('falls back to ORS when VROOM reports a routing error code', async () => {
    vroomServiceMock.isConfigured.mockReturnValue(true);
    vroomServiceMock.optimize.mockResolvedValue({
      code: 3,
      error: 'Routing backend failed',
    });
    httpServiceMock.post.mockReturnValue(
      of({
        data: {
          features: [
            {
              geometry: {
                type: 'LineString',
                coordinates: [
                  [51.17, 43.65],
                  [49.89, 40.37],
                ],
              },
              properties: {
                summary: {
                  distance: 682120,
                  duration: 44432,
                },
              },
            },
          ],
        },
      }),
    );
    routesRepositoryMock.create.mockImplementation((data: object) =>
      Promise.resolve({ id: 'route-fb-ors', ...data }),
    );

    const result = await service.calculate(clientUser, {
      startLat: 43.65,
      startLng: 51.17,
      endLat: 40.37,
      endLng: 49.89,
    });

    expect(result.distanceKm).toBe(682.12);
    expect(result.durationMinutes).toBe(740.53);
  });

  it('falls back to ORS when VROOM route has no geometry', async () => {
    vroomServiceMock.isConfigured.mockReturnValue(true);
    vroomServiceMock.optimize.mockResolvedValue({
      code: 0,
      routes: [{ vehicle: 1, distance: 1000, duration: 120, steps: [] }],
    });
    vroomServiceMock.decodeRoute.mockImplementation(() => {
      throw new BadGatewayException('VROOM returned no route geometry');
    });
    httpServiceMock.post.mockReturnValue(
      of({
        data: {
          features: [
            {
              geometry: {
                type: 'LineString',
                coordinates: [
                  [51.17, 43.65],
                  [49.89, 40.37],
                ],
              },
              properties: {
                summary: {
                  distance: 682120,
                  duration: 44432,
                },
              },
            },
          ],
        },
      }),
    );
    routesRepositoryMock.create.mockImplementation((data: object) =>
      Promise.resolve({ id: 'route-fb-ors', ...data }),
    );

    const result = await service.calculate(clientUser, {
      startLat: 43.65,
      startLng: 51.17,
      endLat: 40.37,
      endLng: 49.89,
    });

    expect(result.distanceKm).toBe(682.12);
  });

  it('uses straight-line fallback when VROOM and ORS both fail on order creation', async () => {
    vroomServiceMock.isConfigured.mockReturnValue(true);
    vroomServiceMock.optimize.mockResolvedValue({
      code: 3,
      error: 'Routing backend failed',
    });
    httpServiceMock.post.mockImplementation(() =>
      throwError(() => {
        const error = new AxiosError('Unfound route');
        (error as { response?: unknown }).response = {
          status: 400,
          data: { error: 'Unfound route' },
        };
        return error;
      }),
    );
    routesRepositoryMock.create.mockImplementation((data: object) =>
      Promise.resolve({ id: 'route-fb-line', ...data }),
    );

    const result = await service.calculateForOrder(order);

    const expectedDistance = Number(
      haversineKm(
        order.originLat,
        order.originLng,
        order.destinationLat,
        order.destinationLng,
      ).toFixed(2),
    );
    expect(result.distanceKm).toBe(expectedDistance);
    expect(result.durationMinutes).toBe(
      Number(((expectedDistance / 50) * 60).toFixed(2)),
    );
    expect(result.geometry).toEqual({
      type: 'LineString',
      coordinates: [
        [order.originLng, order.originLat],
        [order.destinationLng, order.destinationLat],
      ],
    });
  });

  it('caches ORS responses for identical coordinates', async () => {
    httpServiceMock.post.mockReturnValue(
      of({
        data: {
          features: [
            {
              geometry: {
                type: 'LineString',
                coordinates: [
                  [51.17, 43.65],
                  [49.89, 40.37],
                ],
              },
              properties: {
                summary: {
                  distance: 1000,
                  duration: 600,
                },
              },
            },
          ],
        },
      }),
    );
    routesRepositoryMock.create.mockImplementation((data: object) =>
      Promise.resolve({ id: 'route-cached', ...data }),
    );

    const dto = {
      startLat: 43.65,
      startLng: 51.17,
      endLat: 40.37,
      endLng: 49.89,
    };

    await service.calculate(clientUser, dto);
    await service.calculate(clientUser, dto);
    expect(httpServiceMock.post).toHaveBeenCalledTimes(1);

    await service.calculate(clientUser, { ...dto, endLat: 40.38 });
    expect(httpServiceMock.post).toHaveBeenCalledTimes(2);
  });

  it('builds an optimized multi-stop plan via VROOM with ordered pickup/delivery stops', async () => {
    vroomServiceMock.isConfigured.mockReturnValue(true);
    vroomServiceMock.optimize.mockResolvedValue({
      code: 0,
      routes: [
        {
          vehicle: 1,
          distance: 70000,
          duration: 4500,
          steps: [
            { type: 'start', location: [51.16, 43.65] },
            { type: 'pickup', job: 0, location: [51.19, 43.65] },
            { type: 'pickup', job: 2, location: [51.3, 43.6] },
            { type: 'delivery', job: 1, location: [52.86, 43.34] },
            { type: 'delivery', job: 3, location: [51.68, 43.18] },
          ],
        },
      ],
    });
    vroomServiceMock.decodeRoute.mockReturnValue({
      distanceKm: 70,
      durationMinutes: 75,
      coordinates: [
        [51.16, 43.65],
        [51.19, 43.65],
        [51.3, 43.6],
        [52.86, 43.34],
        [51.68, 43.18],
      ],
    });
    prismaMock.order.findMany.mockResolvedValue([
      { ...order, id: 'o1' },
      { ...order, id: 'o2', originLat: 43.6, originLng: 51.3 },
    ]);
    prismaMock.vehicle.findMany.mockResolvedValue([carrierVehicle]);
    carrierProfileRepositoryMock.findByUserId.mockResolvedValue(carrierProfile);

    const result = await service.calculateCarrierRoute(carrierUser);

    expect(result.strategy).toBe('vroom');
    expect(result.capacityTons).toBe(20);
    expect(result.orders.length).toBe(2);
    expect(result.stops.map((stop) => stop.action)).toEqual([
      'pickup',
      'pickup',
      'delivery',
      'delivery',
    ]);
    expect(result.sequence).toEqual(['o1', 'o2']);
    expect(result.route?.distanceKm).toBe(70);
  });

  it('falls back to greedy ordering and reports free capacity when VROOM is not configured', async () => {
    vroomServiceMock.isConfigured.mockReturnValue(false);
    prismaMock.order.findMany.mockResolvedValue([
      { ...order, id: 'o1' },
      { ...order, id: 'o2', originLat: 43.6, originLng: 51.3 },
    ]);
    prismaMock.vehicle.findMany.mockResolvedValue([carrierVehicle]);
    carrierProfileRepositoryMock.findByUserId.mockResolvedValue(carrierProfile);

    const result = await service.calculateCarrierRoute(carrierUser);

    expect(result.strategy).toBe('greedy');
    expect(result.capacityTons).toBe(20);
    expect(result.freeTons).toBe(19.976);
    expect(result.sequence.length).toBe(2);
    const pickupIndex = (id: string) =>
      result.stops.findIndex(
        (stop) => stop.orderId === id && stop.action === 'pickup',
      );
    const deliveryIndex = (id: string) =>
      result.stops.findIndex(
        (stop) => stop.orderId === id && stop.action === 'delivery',
      );
    for (const id of ['o1', 'o2']) {
      expect(pickupIndex(id)).toBeLessThan(deliveryIndex(id));
    }
    expect(result.route?.distanceKm).toBeGreaterThan(0);
  });

  it('returns an empty plan when the carrier has no active orders', async () => {
    vroomServiceMock.isConfigured.mockReturnValue(false);
    prismaMock.order.findMany.mockResolvedValue([]);
    prismaMock.vehicle.findMany.mockResolvedValue([carrierVehicle]);
    carrierProfileRepositoryMock.findByUserId.mockResolvedValue(carrierProfile);

    const result = await service.calculateCarrierRoute(carrierUser);

    expect(result.strategy).toBe('none');
    expect(result.orders).toEqual([]);
    expect(result.route).toBeNull();
    expect(result.stops).toEqual([]);
  });
});
