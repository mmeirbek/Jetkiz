import { PredictionsService } from './predictions.service';

describe('PredictionsService', () => {
  const prismaMock = {
    order: { findUnique: jest.fn() },
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

  beforeEach(() => {
    jest.clearAllMocks();
    service = new PredictionsService(
      prismaMock as never,
      routesServiceMock as never,
      openWeatherServiceMock as never,
      routePointResolverMock as never,
      aggregatorServiceMock as never,
      openAiServiceMock as never,
    );
  });

  it('fetches order, calculates route, returns prediction with orderId', async () => {
    prismaMock.order.findUnique.mockResolvedValue({
      id: 'order-1',
      originLat: 43.65,
      originLng: 51.17,
      destinationLat: 40.37,
      destinationLng: 49.89,
    });

    routesServiceMock.calculate.mockResolvedValue({
      distanceKm: 1200,
      durationMinutes: 960,
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

    aggregatorServiceMock.aggregate.mockReturnValue({
      route: { distanceKm: 1200, durationHours: 16 },
      weather: { risk: 'low', wind: 10, rain: false },
      checkpoints: [],
      railway: [],
    });

    openAiServiceMock.predict.mockResolvedValue({
      recommendation: 'send',
      riskLevel: 'low',
      bestDepartureTime: '2026-06-13T08:00:00.000Z',
      expectedDelayMinutes: 20,
      shortExplanation: 'Низкий риск.',
    });

    const result = await service.predictLand('order-1');

    expect(result).toEqual({
      orderId: 'order-1',
      recommendation: 'send',
      riskLevel: 'low',
      bestDepartureTime: '2026-06-13T08:00:00.000Z',
      expectedDelayMinutes: 20,
      shortExplanation: 'Низкий риск.',
    });
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
