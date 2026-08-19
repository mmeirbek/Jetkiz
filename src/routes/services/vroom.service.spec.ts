import {
  BadGatewayException,
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common';
import { AxiosError } from 'axios';
import { of, throwError } from 'rxjs';
import { VroomService, decodePolyline } from './vroom.service';

describe('VroomService', () => {
  const httpServiceMock = {
    post: jest.fn(),
  };

  let service: VroomService;
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    jest.clearAllMocks();
    originalEnv = process.env;
    process.env = {
      ...originalEnv,
      VROOM_URL: 'http://localhost:3003',
    };

    service = new VroomService(httpServiceMock as never);
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('reports configured when VROOM_URL is set', () => {
    expect(service.isConfigured()).toBe(true);
  });

  it('reports not configured when VROOM_URL is missing', () => {
    delete process.env.VROOM_URL;
    expect(service.isConfigured()).toBe(false);
  });

  it('posts an optimization request to the VROOM API', async () => {
    httpServiceMock.post.mockReturnValue(
      of({
        data: {
          code: 0,
          summary: { distance: 682120, duration: 44432 },
          routes: [
            {
              vehicle: 1,
              distance: 682120,
              duration: 44432,
              steps: [],
            },
          ],
        },
      }),
    );

    const result = await service.optimize({
      jobs: [{ id: 1, location: [49.89, 40.37] }],
      vehicles: [{ id: 1, start: [51.17, 43.65], end: [49.89, 40.37] }],
      options: { g: true },
    });

    expect(httpServiceMock.post).toHaveBeenCalledWith(
      'http://localhost:3003/',
      {
        jobs: [{ id: 1, location: [49.89, 40.37] }],
        vehicles: [{ id: 1, start: [51.17, 43.65], end: [49.89, 40.37] }],
        options: { g: true },
      },
      { timeout: 60000 },
    );
    expect(result.code).toBe(0);
  });

  it('throws when VROOM_URL is not configured', async () => {
    delete process.env.VROOM_URL;

    await expect(service.optimize({ jobs: [], vehicles: [] })).rejects.toThrow(
      InternalServerErrorException,
    );
  });

  it('throws bad gateway when VROOM is unreachable', async () => {
    httpServiceMock.post.mockReturnValue(
      throwError(() => new Error('network failed')),
    );

    await expect(service.optimize({ jobs: [], vehicles: [] })).rejects.toThrow(
      BadGatewayException,
    );
  });

  it('throws bad request when VROOM rejects the input', async () => {
    httpServiceMock.post.mockReturnValue(
      throwError(
        () =>
          new AxiosError(
            'Request failed with status code 400',
            'ERR_BAD_REQUEST',
            undefined,
            undefined,
            {
              status: 400,
              statusText: 'Bad Request',
              headers: {},
              config: undefined as never,
              data: { code: 2, error: 'Invalid profile: car.' },
            },
          ),
      ),
    );

    await expect(service.optimize({ jobs: [], vehicles: [] })).rejects.toThrow(
      BadRequestException,
    );
  });

  it('throws bad gateway when VROOM routing backend fails', async () => {
    httpServiceMock.post.mockReturnValue(
      throwError(
        () =>
          new AxiosError(
            'Request failed with status code 500',
            'ERR_BAD_REQUEST',
            undefined,
            undefined,
            {
              status: 500,
              statusText: 'Internal Server Error',
              headers: {},
              config: undefined as never,
              data: { code: 3, error: 'Routing backend failed' },
            },
          ),
      ),
    );

    await expect(service.optimize({ jobs: [], vehicles: [] })).rejects.toThrow(
      BadGatewayException,
    );
  });

  it('decodes route distance and duration from a VROOM route', () => {
    const decoded = service.decodeRoute({
      vehicle: 1,
      distance: 682120,
      duration: 44432,
      steps: [
        {
          type: 'start',
          location: [51.17, 43.65],
        },
        {
          type: 'end',
          location: [49.89, 40.37],
          geometry: '_i~pEo|spOqi@nCuy@|lApz@`yA',
        },
      ],
    });

    expect(decoded.distanceKm).toBe(682.12);
    expect(decoded.durationMinutes).toBe(740.53);
    expect(decoded.coordinates.length).toBeGreaterThan(1);
  });

  it('decodes route-level geometry when steps have none (VROOM 1.15)', () => {
    const decoded = service.decodeRoute({
      vehicle: 1,
      distance: 6994,
      duration: 576,
      geometry: 's||lF}c{cPzAoGv@eBa@t@q@dAcC',
      steps: [
        {
          type: 'start',
          location: [76.9456, 43.2383],
        },
        {
          type: 'job',
          id: 1,
          location: [76.99, 43.27],
        },
      ],
    });

    expect(decoded.distanceKm).toBe(6.99);
    expect(decoded.durationMinutes).toBe(9.6);
    expect(decoded.coordinates.length).toBeGreaterThan(1);
  });

  it('throws bad gateway when route payload is invalid', () => {
    expect(() => service.decodeRoute(undefined)).toThrow(BadGatewayException);
  });

  it('throws bad gateway when route has no geometry', () => {
    expect(() =>
      service.decodeRoute({
        vehicle: 1,
        distance: 100,
        duration: 60,
        steps: [],
      }),
    ).toThrow(BadGatewayException);
  });

  it('decodes a Google-encoded polyline', () => {
    const coords = decodePolyline('_p~iF~ps|U_ulLnnqC_mqNvxq`@');
    expect(coords.length).toBeGreaterThan(1);
    expect(coords[0]).toEqual([expect.any(Number), expect.any(Number)]);
  });
});
