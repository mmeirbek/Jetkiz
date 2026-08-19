import { HttpService } from '@nestjs/axios';
import {
  BadGatewayException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AxiosError } from 'axios';
import { randomUUID } from 'crypto';
import { firstValueFrom } from 'rxjs';
import { PrismaService } from '../../prisma/prisma.service';
import {
  parseCheckpointCatalogPage,
  parseScoreboardPage,
} from '../utils/qoldau-scraper.util';

const CONCURRENCY = 10;

type SyncCheckpointLoadResult = {
  syncBatchId: string;
  fetchedAt: string;
  checkpointsCount: number;
  activeWaitingTotal: number;
};

type CheckpointLoad = {
  checkpointName: string;
  borderCountry: string | null;
  region: string | null;
  waitingAreaCount: number;
};

@Injectable()
export class CheckpointLoadsService {
  private readonly qoldauBaseUrl = 'https://cgr.qoldau.kz/ru';

  constructor(
    private readonly httpService: HttpService,
    private readonly prisma: PrismaService,
  ) {}

  async syncCurrentLoads(): Promise<SyncCheckpointLoadResult> {
    const checkpoints = await this.fetchCheckpointCatalog();
    const loads = await this.fetchScoreboardLoads(checkpoints);
    const fetchedAt = new Date();
    const syncBatchId = randomUUID();

    await this.prisma.$transaction(
      loads.map((load) =>
        this.prisma.checkpointLoadSnapshot.create({
          data: {
            syncBatchId,
            source: 'qoldau',
            checkpointName: load.checkpointName,
            borderCountry: load.borderCountry,
            region: load.region,
            waitingAreaCount: load.waitingAreaCount,
            activeTruckNumbers: [],
            entryTimes: [],
            raw: { checkpoint: load },
            fetchedAt,
          },
        }),
      ),
    );

    await this.syncCheckpointTable(loads);

    return {
      syncBatchId,
      fetchedAt: fetchedAt.toISOString(),
      checkpointsCount: loads.length,
      activeWaitingTotal: loads.reduce((sum, l) => sum + l.waitingAreaCount, 0),
    };
  }

  async getCurrentLoads() {
    const latest = await this.prisma.checkpointLoadSnapshot.findFirst({
      orderBy: [{ fetchedAt: 'desc' }, { id: 'desc' }],
    });

    if (!latest) {
      throw new NotFoundException(
        'No checkpoint load snapshots found. Run sync first.',
      );
    }

    const snapshots = await this.prisma.checkpointLoadSnapshot.findMany({
      where: {
        syncBatchId: latest.syncBatchId,
      },
      orderBy: [{ waitingAreaCount: 'desc' }, { checkpointName: 'asc' }],
    });

    return {
      syncBatchId: latest.syncBatchId,
      fetchedAt: latest.fetchedAt.toISOString(),
      checkpoints: snapshots.map((snapshot) => ({
        checkpointName: snapshot.checkpointName,
        borderCountry: snapshot.borderCountry,
        region: snapshot.region,
        waitingAreaCount: snapshot.waitingAreaCount,
        activeTruckNumbers: snapshot.activeTruckNumbers,
        entryTimes: snapshot.entryTimes,
        source: snapshot.source,
      })),
    };
  }

  private async syncCheckpointTable(loads: CheckpointLoad[]) {
    const existing = await this.prisma.checkpoint.findMany({
      where: { name: { in: loads.map((l) => l.checkpointName) } },
    });

    for (const load of loads) {
      await this.prisma.checkpoint.upsert({
        where: { name: load.checkpointName },
        update: {
          loadPercent: load.waitingAreaCount,
        },
        create: {
          name: load.checkpointName,
          loadPercent: load.waitingAreaCount,
          avgWaitMinutes: 0,
          latitude: 0,
          longitude: 0,
        },
      });
    }

    for (const existingCp of existing) {
      if (!loads.some((l) => l.checkpointName === existingCp.name)) {
        await this.prisma.checkpoint.update({
          where: { id: existingCp.id },
          data: { loadPercent: 0 },
        });
      }
    }
  }

  private async fetchCheckpointCatalog() {
    const firstPageHtml = await this.fetchHtml('/registry/checkpoint/list');
    const firstPage = parseCheckpointCatalogPage(firstPageHtml);
    const items = [...firstPage.items];

    for (let page = 2; page <= firstPage.totalPages; page += 1) {
      const html = await this.fetchHtml(`/registry/checkpoint/list?p=${page}`);
      items.push(...parseCheckpointCatalogPage(html).items);
    }

    const deduped = new Map<string, (typeof items)[number]>();
    for (const item of items) {
      if (!deduped.has(item.checkpointName)) {
        deduped.set(item.checkpointName, item);
      }
    }

    return [...deduped.values()];
  }

  private async fetchScoreboardLoads(
    checkpoints: Awaited<
      ReturnType<CheckpointLoadsService['fetchCheckpointCatalog']>
    >,
  ): Promise<CheckpointLoad[]> {
    const loads: CheckpointLoad[] = [];

    for (let i = 0; i < checkpoints.length; i += CONCURRENCY) {
      const batch = checkpoints.slice(i, i + CONCURRENCY);
      const results = await Promise.all(
        batch.map((cp) => this.fetchSingleCheckpointLoad(cp)),
      );
      loads.push(...results);
    }

    return loads;
  }

  private async fetchSingleCheckpointLoad(
    checkpoint: Awaited<
      ReturnType<CheckpointLoadsService['fetchCheckpointCatalog']>
    >[number],
  ): Promise<CheckpointLoad> {
    try {
      const html = await this.fetchHtml(
        `/registry/scoreboard?flCheckpoint=${checkpoint.checkpointId}`,
      );
      const parsed = parseScoreboardPage(html);

      return {
        checkpointName: checkpoint.checkpointName,
        borderCountry: checkpoint.borderCountry,
        region: checkpoint.region,
        waitingAreaCount: parsed.totalRecords,
      };
    } catch {
      return {
        checkpointName: checkpoint.checkpointName,
        borderCountry: checkpoint.borderCountry,
        region: checkpoint.region,
        waitingAreaCount: 0,
      };
    }
  }

  private async fetchHtml(path: string) {
    try {
      const response = await firstValueFrom(
        this.httpService.get<string>(`${this.qoldauBaseUrl}${path}`, {
          responseType: 'text',
          timeout: 15000,
          headers: {
            Accept: 'text/html,application/xhtml+xml',
          },
        }),
      );

      return response.data;
    } catch (error) {
      if (error instanceof AxiosError && !error.response) {
        throw new BadGatewayException('Qoldau is unavailable');
      }

      throw new BadGatewayException('Failed to fetch Qoldau public pages');
    }
  }
}
