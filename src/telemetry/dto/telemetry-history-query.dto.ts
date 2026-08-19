import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsISO8601, IsOptional } from 'class-validator';

export enum TelemetryBucket {
  MIN_1 = '1m',
  MIN_5 = '5m',
  MIN_15 = '15m',
  HOUR_1 = '1h',
  HOUR_6 = '6h',
  DAY_1 = '1d',
}

export const BUCKET_MINUTES: Record<TelemetryBucket, number> = {
  [TelemetryBucket.MIN_1]: 1,
  [TelemetryBucket.MIN_5]: 5,
  [TelemetryBucket.MIN_15]: 15,
  [TelemetryBucket.HOUR_1]: 60,
  [TelemetryBucket.HOUR_6]: 360,
  [TelemetryBucket.DAY_1]: 1440,
};

export class TelemetryHistoryQueryDto {
  @ApiPropertyOptional({
    example: '2026-08-19T00:00:00.000Z',
    description: 'Start of the range (ISO 8601). Defaults to 24h before now.',
  })
  @IsOptional()
  @IsISO8601()
  from?: string;

  @ApiPropertyOptional({
    example: '2026-08-19T23:59:59.000Z',
    description: 'End of the range (ISO 8601). Defaults to now.',
  })
  @IsOptional()
  @IsISO8601()
  to?: string;

  @ApiPropertyOptional({
    enum: TelemetryBucket,
    default: TelemetryBucket.HOUR_1,
    description: 'Aggregation bucket size',
  })
  @IsOptional()
  @IsEnum(TelemetryBucket)
  bucket?: TelemetryBucket;
}
