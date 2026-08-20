import { HttpService } from '@nestjs/axios';
import { of } from 'rxjs';
import { GeocodeService } from './geocode.service';

describe('GeocodeService', () => {
  const prismaMock = { settlement: { findMany: jest.fn() } };
  const httpServiceMock = { get: jest.fn() };

  let service: GeocodeService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new GeocodeService(prismaMock as never, httpServiceMock as never);
  });

  it('returns local settlement matches first', async () => {
    prismaMock.settlement.findMany.mockResolvedValue([
      {
        id: 'set-1',
        name: 'Aktau',
        nameRu: 'Актау',
        nameKk: 'Ақтау',
        type: 'city',
        district: 'Aktau',
        latitude: 43.65,
        longitude: 51.17,
        source: 'seed',
      },
    ]);
    httpServiceMock.get.mockReturnValue(of({ data: [] }));

    const results = await service.search('актау');

    expect(results).toHaveLength(1);
    expect(results[0].settlementId).toBe('set-1');
    expect(results[0].source).toBe('local');
    expect(results[0].latitude).toBe(43.65);
  });

  it('appends OSM results and dedupes by coordinates', async () => {
    prismaMock.settlement.findMany.mockResolvedValue([]);
    httpServiceMock.get.mockReturnValue(
      of({
        data: [
          { display_name: 'Актау, Мангистауская область', lat: '43.65', lon: '51.17' },
          { display_name: 'Актау, другое место', lat: '42.9', lon: '58.5' },
        ],
      }),
    );

    const results = await service.search('aktau port');

    expect(results).toHaveLength(2);
    expect(results.map((r) => r.source)).toEqual(['osm', 'osm']);
    expect(results[0].longitude).toBe(51.17);
  });

  it('returns empty for short queries', async () => {
    const results = await service.search('a');
    expect(results).toEqual([]);
  });

  it('returns local results even when OSM fails', async () => {
    prismaMock.settlement.findMany.mockResolvedValue([
      {
        id: 'set-2',
        name: 'Zhanaozen',
        nameRu: 'Жанаозен',
        nameKk: 'Жаңаөзен',
        type: 'city',
        district: 'Zhanaozen',
        latitude: 43.34,
        longitude: 52.86,
        source: 'seed',
      },
    ]);
    httpServiceMock.get.mockImplementation(() => {
      throw new (require('@nestjs/common').BadGatewayException)('boom');
    });

    const results = await service.search('жанаозен');

    expect(results).toHaveLength(1);
    expect(results[0].settlementId).toBe('set-2');
  });
});