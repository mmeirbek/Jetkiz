import {
  BadGatewayException,
  BadRequestException,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { AxiosError } from 'axios';
import { OrderStatus, UserRole } from '@prisma/client';
import { of, throwError } from 'rxjs';
import { RoutesService } from './routes.service';

describe('RoutesService', () => {
  const httpServiceMock = {
    post: jest.fn(),
  };
  const prismaMock = {
    order: {
      findUnique: jest.fn(),
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
              config: {} as any,
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
              config: {} as any,
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

  it('throws bad gateway when VROOM returns a routing error code', async () => {
    vroomServiceMock.isConfigured.mockReturnValue(true);
    vroomServiceMock.optimize.mockResolvedValue({
      code: 3,
      error: 'Routing backend failed',
    });

    await expect(
      service.calculate(clientUser, {
        startLat: 43.65,
        startLng: 51.17,
        endLat: 40.37,
        endLng: 49.89,
      }),
    ).rejects.toThrow(BadGatewayException);
  });

  it('throws bad gateway when VROOM route has no geometry', async () => {
    vroomServiceMock.isConfigured.mockReturnValue(true);
    vroomServiceMock.optimize.mockResolvedValue({
      code: 0,
      routes: [{ vehicle: 1, distance: 1000, duration: 120, steps: [] }],
    });
    vroomServiceMock.decodeRoute.mockImplementation(() => {
      throw new BadGatewayException('VROOM returned no route geometry');
    });

    await expect(
      service.calculate(clientUser, {
        startLat: 43.65,
        startLng: 51.17,
        endLat: 40.37,
        endLng: 49.89,
      }),
    ).rejects.toThrow(BadGatewayException);
  });
});
