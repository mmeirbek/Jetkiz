import { of } from 'rxjs';
import { CheckpointLoadsService } from './checkpoint-loads.service';

describe('CheckpointLoadsService', () => {
  const httpServiceMock = {
    get: jest.fn(),
  };

  const prismaMock = {
    checkpointLoadSnapshot: {
      create: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
    },
    checkpoint: {
      findMany: jest.fn(),
      upsert: jest.fn(),
      update: jest.fn(),
    },
    $transaction: jest.fn(),
  };

  let service: CheckpointLoadsService;

  beforeEach(() => {
    jest.clearAllMocks();
    prismaMock.$transaction.mockImplementation(
      async (operations: unknown[]) => {
        for (const operation of operations) {
          await operation;
        }
        return [];
      },
    );
    prismaMock.checkpointLoadSnapshot.create.mockResolvedValue(undefined);
    prismaMock.checkpoint.findMany.mockResolvedValue([]);
    prismaMock.checkpoint.upsert.mockResolvedValue(undefined);
    prismaMock.checkpoint.update.mockResolvedValue(undefined);
    service = new CheckpointLoadsService(
      httpServiceMock as never,
      prismaMock as never,
    );
  });

  it('syncs checkpoint loads from scoreboard', async () => {
    httpServiceMock.get
      .mockReturnValueOnce(
        of({
          data: `
            <div class="row border-bottom py-2">
              <div class="col-sm-8">
                <div class="col-md-8">
                  <a href="/ru/registry/checkpoint/list/12345/view" class="font-weight-bold font-16">Достык - Алашанькоу</a>
                  <span class="text-secondary font-12">область Жетісу, Алакольский район</span>
                </div>
                <div class="col-md-4"><span class="font-weight-bold">Китай</span></div>
              </div>
            </div>
          `,
        }),
      )
      .mockReturnValueOnce(
        of({
          data: `<span><small>Всего записей</small> 315</span>`,
        }),
      );

    const result = await service.syncCurrentLoads();

    expect(result.checkpointsCount).toBe(1);
    expect(result.activeWaitingTotal).toBe(315);
    expect(httpServiceMock.get).toHaveBeenCalledWith(
      'https://cgr.qoldau.kz/ru/registry/scoreboard?flCheckpoint=12345',
      expect.any(Object),
    );
    expect(prismaMock.checkpointLoadSnapshot.create).toHaveBeenCalledWith(
      expect.objectContaining({
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment -- jest.objectContaining returns `any`
        data: expect.objectContaining({
          checkpointName: 'Достык - Алашанькоу',
          borderCountry: 'Китай',
          waitingAreaCount: 315,
          source: 'qoldau',
        }),
      }),
    );
    expect(prismaMock.checkpoint.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { name: 'Достык - Алашанькоу' },
        update: { loadPercent: 315 },
      }),
    );
  });

  it('handles scoreboard fetch failure gracefully', async () => {
    httpServiceMock.get
      .mockReturnValueOnce(
        of({
          data: `
            <div class="row border-bottom py-2">
              <div class="col-sm-8">
                <div class="col-md-8">
                  <a href="/ru/registry/checkpoint/list/12345/view" class="font-weight-bold font-16">Достык - Алашанькоу</a>
                </div>
                <div class="col-md-4"><span class="font-weight-bold">Китай</span></div>
              </div>
            </div>
          `,
        }),
      )
      .mockReturnValueOnce(
        of({
          data: 'error page',
        }),
      );

    const result = await service.syncCurrentLoads();

    expect(result.checkpointsCount).toBe(1);
    expect(result.activeWaitingTotal).toBe(0);
    expect(prismaMock.checkpointLoadSnapshot.create).toHaveBeenCalledWith(
      expect.objectContaining({
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment -- jest.objectContaining returns `any`
        data: expect.objectContaining({
          waitingAreaCount: 0,
        }),
      }),
    );
  });

  it('returns latest snapshot batch', async () => {
    prismaMock.checkpointLoadSnapshot.findFirst.mockResolvedValue({
      id: 'snapshot-1',
      syncBatchId: 'batch-1',
      fetchedAt: new Date('2026-06-12T00:10:00.000Z'),
    });
    prismaMock.checkpointLoadSnapshot.findMany.mockResolvedValue([
      {
        checkpointName: 'Достык - Алашанькоу',
        borderCountry: 'Китай',
        region: 'область Жетісу, Алакольский район',
        waitingAreaCount: 315,
        activeTruckNumbers: [],
        entryTimes: [],
        source: 'qoldau',
      },
    ]);

    const result = await service.getCurrentLoads();

    expect(result).toEqual({
      syncBatchId: 'batch-1',
      fetchedAt: '2026-06-12T00:10:00.000Z',
      checkpoints: [
        {
          checkpointName: 'Достык - Алашанькоу',
          borderCountry: 'Китай',
          region: 'область Жетісу, Алакольский район',
          waitingAreaCount: 315,
          activeTruckNumbers: [],
          entryTimes: [],
          source: 'qoldau',
        },
      ],
    });
  });
});
