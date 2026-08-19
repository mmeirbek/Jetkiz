import { RoutePointResolverService } from './route-point-resolver.service';

describe('RoutePointResolverService', () => {
  const prismaMock = {
    checkpoint: {
      findMany: jest.fn(),
    },
    trainSchedule: {
      findMany: jest.fn(),
    },
  };

  let service: RoutePointResolverService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new RoutePointResolverService(prismaMock as never);
  });

  describe('getWeatherWaypoints', () => {
    it('returns 5 evenly spaced waypoints', () => {
      const geometry: number[][] = [];
      for (let i = 0; i < 100; i++) {
        geometry.push([50 + i * 0.01, 40 + i * 0.01]);
      }

      const result = service.getWeatherWaypoints(geometry, 5);

      expect(result).toHaveLength(5);
      expect(result[0]).toEqual({ lat: 40, lng: 50 });
      expect(result[4]).toEqual({ lat: 40.99, lng: 50.99 });
    });

    it('returns all points when fewer than requested', () => {
      const geometry = [
        [51.17, 43.65],
        [49.89, 40.37],
      ];

      const result = service.getWeatherWaypoints(geometry, 5);

      expect(result).toHaveLength(2);
    });

    it('returns empty array for empty geometry', () => {
      expect(service.getWeatherWaypoints([], 5)).toEqual([]);
    });
  });

  describe('findNearbyCheckpoints', () => {
    it('filters checkpoints within max distance', async () => {
      const geometry = [
        [51.17, 43.65],
        [51.5, 43.8],
      ];

      prismaMock.checkpoint.findMany.mockResolvedValue([
        {
          id: '1',
          name: 'Near',
          loadPercent: 50,
          avgWaitMinutes: 30,
          latitude: 43.66,
          longitude: 51.18,
          updatedAt: new Date(),
        },
        {
          id: '2',
          name: 'Far',
          loadPercent: 30,
          avgWaitMinutes: 20,
          latitude: 50,
          longitude: 70,
          updatedAt: new Date(),
        },
      ]);

      const result = await service.findNearbyCheckpoints(geometry, 50);

      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('Near');
    });

    it('returns empty when no checkpoints nearby', async () => {
      prismaMock.checkpoint.findMany.mockResolvedValue([
        {
          id: '1',
          name: 'Far',
          loadPercent: 30,
          avgWaitMinutes: 20,
          latitude: 50,
          longitude: 70,
          updatedAt: new Date(),
        },
      ]);

      const result = await service.findNearbyCheckpoints([[51.17, 43.65]], 10);

      expect(result).toHaveLength(0);
    });
  });

  describe('findNearbyRailwayNodes', () => {
    it('filters nodes within max distance', async () => {
      const geometry = [
        [51.17, 43.65],
        [51.5, 43.8],
      ];

      prismaMock.trainSchedule.findMany.mockResolvedValue([
        {
          id: '1',
          stationName: 'Near Station',
          departuresPerDay: 10,
          currentLoad: 50,
          avgDelayMinutes: 15,
          latitude: 43.66,
          longitude: 51.18,
          updatedAt: new Date(),
        },
      ]);

      const result = await service.findNearbyRailwayNodes(geometry, 50);

      expect(result).toHaveLength(1);
      expect(result[0].stationName).toBe('Near Station');
    });
  });
});
