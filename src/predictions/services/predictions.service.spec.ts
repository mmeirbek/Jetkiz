import { PredictionsService } from './predictions.service';

describe('PredictionsService', () => {
  const prismaMock = {
    order: { findUnique: jest.fn(), findMany: jest.fn() },
    orderPrediction: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      upsert: jest.fn(),
    },
  };
  const routesServiceMock = { calculate: jest.fn() };
  const openWeatherServiceMock = { getWeatherForPoints: jest.fn() };
  const routePointResolverMock = {
    getWeatherWaypoints: jest.fn(),
    findNearbyCheckpoints: jest.fn(),
    findNearbyRailwayNodes: jest.fn(),
  };
  const aggregatorServiceMock = { aggregate: jest.fn() };
  const openAiServiceMock = { predict: jest.fn() };

  let service: PredictionsService;

  const order = {
    id: 'order-1',
    title: 'Стройматериалы',
    origin: 'Актау',
    destination: 'Жанаозен',
    originLat: 43.65,
    originLng: 51.17,
    destinationLat: 43.34,
    destinationLng: 52.86,
  };

  const aggregated = {
    route: { distanceKm: 149, durationHours: 3.1 },
    weather: { risk: 'low' as const, wind: 10, rain: false },
    checkpoints: [],
    railway: [],
  };

  beforeEach(() => {
    jest.clearAllMocks();
    delete process.env.OPENAI_API_KEY;
    service = new PredictionsService(
      prismaMock as never,
      routesServiceMock as never,
      openWeatherServiceMock as never,
      routePointResolverMock as never,
      aggregatorServiceMock as never,
      openAiServiceMock as never,
    );
  });

  function mockCollectData() {
    routesServiceMock.calculate.mockResolvedValue({
      distanceKm: 149,
      durationMinutes: 186,
      geometry: { type: 'LineString', coordinates: [[51.17, 43.65]] },
    });
    routePointResolverMock.getWeatherWaypoints.mockReturnValue([
      { lat: 43.65, lng: 51.17 },
    ]);
    openWeatherServiceMock.getWeatherForPoints.mockResolvedValue([
      {
        lat: 43.65,
        lng: 51.17,
        temperature: 25,
        windSpeed: 10,
        rain: false,
        snow: false,
        description: 'clear',
      },
    ]);
    routePointResolverMock.findNearbyCheckpoints.mockResolvedValue([]);
    routePointResolverMock.findNearbyRailwayNodes.mockResolvedValue([]);
    aggregatorServiceMock.aggregate.mockReturnValue(aggregated);
    prismaMock.orderPrediction.upsert.mockImplementation(
      ({ create }: { create: Record<string, unknown> }) => ({
        id: 'pred-1',
        ...create,
        updatedAt: new Date('2026-08-20T10:00:00.000Z'),
      }),
    );
  }

  it('uses OpenAI when key is present and clamps past departure to the future', async () => {
    process.env.OPENAI_API_KEY = 'sk-test';
    prismaMock.order.findUnique.mockResolvedValue(order);
    prismaMock.orderPrediction.findUnique.mockResolvedValue(null);
    mockCollectData();

    openAiServiceMock.predict.mockResolvedValue({
      recommendation: 'send',
      riskLevel: 'low',
      bestDepartureTime: '2023-10-05T09:00:00.000Z',
      expectedDelayMinutes: 20,
      shortExplanation: 'Низкий риск.',
    });

    const result = await service.predictLand('order-1');

    expect(openAiServiceMock.predict).toHaveBeenCalledWith(aggregated);
    expect(result.orderId).toBe('order-1');
    expect(result.recommendation).toBe('send');
    expect(result.shortExplanation).toBe('Низкий риск.');
    expect(new Date(result.bestDepartureTime).getTime()).toBeGreaterThan(
      Date.now(),
    );
    expect(result.data).toEqual(aggregated);
    expect(result.source).toBe('ai');
  });

  it('falls back to rule-based engine when OpenAI is unavailable', async () => {
    process.env.OPENAI_API_KEY = 'sk-test';
    prismaMock.order.findUnique.mockResolvedValue(order);
    prismaMock.orderPrediction.findUnique.mockResolvedValue(null);
    mockCollectData();
    openAiServiceMock.predict.mockRejectedValue(
      new (require('@nestjs/common').BadGatewayException)('boom'),
    );

    const result = await service.predictLand('order-1');

    expect(result.source).toBe('rule');
    expect(['send', 'wait', 'alternative']).toContain(result.recommendation);
    expect(new Date(result.bestDepartureTime).getTime()).toBeGreaterThan(
      Date.now(),
    );
    expect(result.shortExplanation).toContain('149 км');
  });

  it('returns rule-based prediction without OpenAI key', async () => {
    prismaMock.order.findUnique.mockResolvedValue(order);
    prismaMock.orderPrediction.findUnique.mockResolvedValue(null);
    mockCollectData();

    const result = await service.predictLand('order-1');

    expect(openAiServiceMock.predict).not.toHaveBeenCalled();
    expect(result.source).toBe('rule');
    expect(result.riskLevel).toBe('low');
    expect(result.recommendation).toBe('send');
    expect(new Date(result.bestDepartureTime).getTime()).toBeGreaterThan(
      Date.now(),
    );
  });

  it('returns cached prediction when fresh', async () => {
    prismaMock.order.findUnique.mockResolvedValue(order);
    prismaMock.orderPrediction.findUnique.mockResolvedValue({
      orderId: 'order-1',
      recommendation: 'wait',
      riskLevel: 'high',
      bestDepartureTime: new Date(Date.now() + 3600_000),
      expectedDelayMinutes: 90,
      shortExplanation: 'Кэш.',
      inputSnapshot: aggregated,
      source: 'rule',
      updatedAt: new Date(),
    });

    const result = await service.predictLand('order-1');

    expect(result.recommendation).toBe('wait');
    expect(result.shortExplanation).toBe('Кэш.');
    expect(routesServiceMock.calculate).not.toHaveBeenCalled();
  });

  it('lists predictions for the current user', async () => {
    prismaMock.order.findMany.mockResolvedValue([order]);
    prismaMock.orderPrediction.findMany.mockResolvedValue([]);
    prismaMock.order.findUnique.mockResolvedValue(order);
    mockCollectData();

    const result = await service.listForUser({
      id: 'user-1',
      email: '',
      firstName: '',
      lastName: '',
      phone: '',
      role: 'CLIENT',
      isActive: true,
    });

    expect(result.predictions).toHaveLength(1);
    expect(result.predictions[0].orderId).toBe('order-1');
    expect(result.predictions[0].title).toBe('Стройматериалы');
    expect(result.predictions[0].data).toEqual(aggregated);
  });

  it('throws on missing order', async () => {
    prismaMock.order.findUnique.mockResolvedValue(null);
    await expect(service.predictLand('bad-id')).rejects.toThrow(
      'Order not found',
    );
  });

  it('throws on order without coordinates', async () => {
    prismaMock.order.findUnique.mockResolvedValue({
      id: 'order-2',
      originLat: null,
      originLng: null,
      destinationLat: null,
      destinationLng: null,
    });
    await expect(service.predictLand('order-2')).rejects.toThrow(
      'Order has no coordinates',
    );
  });
});