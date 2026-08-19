import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class TelemetryRecordResponseDto {
  @ApiProperty({ example: 'cmmi83qoc00000kirq90tel' })
  id: string;

  @ApiProperty({ example: 'cmmi83qoc00000kirq90dev' })
  deviceId: string;

  @ApiProperty({ nullable: true, example: 'cmmi83qoc00000kirq90veh' })
  vehicleId: string | null;

  @ApiProperty({ nullable: true, example: 'cmmi83qoc00000kirq90ord' })
  orderId: string | null;

  @ApiProperty({ nullable: true, example: 24.8 })
  temperature: number | null;

  @ApiProperty({ nullable: true, example: 62 })
  humidity: number | null;

  @ApiProperty({ nullable: true, example: 91 })
  battery: number | null;

  @ApiProperty({ nullable: true, example: 78.4 })
  speedKmh: number | null;

  @ApiProperty({ example: 45.3215 })
  lat: number;

  @ApiProperty({ example: 51.1025 })
  lng: number;

  @ApiProperty({ example: '2026-08-19T10:00:00.000Z' })
  eventTime: Date;
}

export class TelemetryEnvelopeResponseDto {
  @ApiProperty({ type: TelemetryRecordResponseDto })
  telemetry: TelemetryRecordResponseDto;
}

export class TelemetryAggregateDto {
  @ApiPropertyOptional({ nullable: true, example: 24.8 })
  avg: number | null;

  @ApiPropertyOptional({ nullable: true, example: 23.1 })
  min: number | null;

  @ApiPropertyOptional({ nullable: true, example: 27.4 })
  max: number | null;
}

export class TelemetryBucketResponseDto {
  @ApiProperty({ example: '2026-08-19T10:00:00.000Z' })
  time: string;

  @ApiProperty({ example: 12 })
  count: number;

  @ApiProperty({ nullable: true, example: 45.3215 })
  lat: number | null;

  @ApiProperty({ nullable: true, example: 51.1025 })
  lng: number | null;

  @ApiPropertyOptional({ nullable: true })
  temperature?: TelemetryAggregateDto | null;

  @ApiPropertyOptional({ nullable: true })
  humidity?: TelemetryAggregateDto | null;

  @ApiPropertyOptional({ nullable: true })
  battery?: TelemetryAggregateDto | null;

  @ApiPropertyOptional({ nullable: true })
  speed?: TelemetryAggregateDto | null;
}

export class TelemetryHistoryResponseDto {
  @ApiProperty({ example: '1h' })
  bucket: string;

  @ApiProperty({ type: [TelemetryBucketResponseDto] })
  points: TelemetryBucketResponseDto[];
}
