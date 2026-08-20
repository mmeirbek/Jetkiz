import { NotFoundException } from '@nestjs/common';
import { SettlementsService } from './settlements.service';

describe('SettlementsService', () => {
  const prismaMock = {
    settlement: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
    },
  };

  const settlement = {
    id: 'aktau',
    name: 'Aktau',
    nameRu: 'Актау',
    nameKk: 'Ақтау',
    type: 'city',
    district: 'Aktau',
    latitude: 43.65,
    longitude: 51.16,
    source: 'Wikipedia',
  };

  let service: SettlementsService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new SettlementsService(prismaMock as never);
  });

  it('lists settlements ordered by district and name', async () => {
    prismaMock.settlement.findMany.mockResolvedValue([settlement]);

    await expect(service.findAll()).resolves.toEqual({
      settlements: [settlement],
    });
    expect(prismaMock.settlement.findMany).toHaveBeenCalledWith({
      orderBy: [{ district: 'asc' }, { name: 'asc' }],
    });
  });

  it('returns a settlement by id', async () => {
    prismaMock.settlement.findUnique.mockResolvedValue(settlement);

    await expect(service.findOne('aktau')).resolves.toEqual({ settlement });
  });

  it('returns 404 for an unknown settlement', async () => {
    prismaMock.settlement.findUnique.mockResolvedValue(null);

    await expect(service.findOne('unknown')).rejects.toThrow(NotFoundException);
  });
});
