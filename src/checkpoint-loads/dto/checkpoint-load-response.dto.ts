import { ApiProperty } from '@nestjs/swagger';

export class CheckpointLoadItemDto {
  @ApiProperty({ example: 'Достык - Алашанькоу' })
  checkpointName: string;

  @ApiProperty({ example: 'Китай', nullable: true })
  borderCountry: string | null;

  @ApiProperty({ example: 'область Жетісу, Алакольский район', nullable: true })
  region: string | null;

  @ApiProperty({ example: 152 })
  waitingAreaCount: number;

  @ApiProperty({
    type: [String],
    example: ['AM8295H', 'B023TY797'],
  })
  activeTruckNumbers: string[];

  @ApiProperty({
    type: [String],
    example: ['12.06.2026 03:01:47', '12.06.2026 04:10:45'],
    description:
      'Entry timestamps of trucks at this checkpoint (within last 48h)',
  })
  entryTimes: string[];

  @ApiProperty({
    description: 'Public source used for the snapshot',
    example: 'qoldau',
  })
  source: string;
}

export class CheckpointLoadSyncResponseDto {
  @ApiProperty({ example: '0f1d3996-1b73-4d40-833d-bb57b2d9709f' })
  syncBatchId: string;

  @ApiProperty({ example: '2026-06-12T00:10:00.000Z' })
  fetchedAt: string;

  @ApiProperty({ example: 49 })
  checkpointsCount: number;

  @ApiProperty({ example: 1085 })
  activeWaitingTotal: number;
}

export class CheckpointLoadCurrentResponseDto {
  @ApiProperty({ example: '0f1d3996-1b73-4d40-833d-bb57b2d9709f' })
  syncBatchId: string;

  @ApiProperty({ example: '2026-06-12T00:10:00.000Z' })
  fetchedAt: string;

  @ApiProperty({ type: [CheckpointLoadItemDto] })
  checkpoints: CheckpointLoadItemDto[];
}
