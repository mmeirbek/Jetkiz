import { ApiProperty } from '@nestjs/swagger';
import { Transform, type TransformFnParams } from 'class-transformer';
import { IsString, MaxLength } from 'class-validator';

const trimString = ({ value }: TransformFnParams): unknown =>
  typeof value === 'string' ? value.trim() : value;

export class LandPredictionRequestDto {
  @ApiProperty({ example: 'cmmi83qoc00000kirq90ord' })
  @Transform(trimString)
  @IsString()
  @MaxLength(50)
  orderId: string;
}

export class LandPredictionDataDto {
  @ApiProperty({
    example: { distanceKm: 149, durationHours: 3.1 },
  })
  route: {
    distanceKm: number;
    durationHours: number;
  };

  @ApiProperty({
    example: { risk: 'medium', wind: 18, rain: true },
  })
  weather: {
    risk: 'low' | 'medium' | 'high';
    wind: number;
    rain: boolean;
  };

  @ApiProperty({
    example: [
      { name: 'КПП Темир Баба', load: 85, wait: 40 },
    ],
  })
  checkpoints: Array<{
    name: string;
    load: number;
    wait: number;
  }>;

  @ApiProperty({ example: [{ station: 'Мангистау', load: 62 }] })
  railway: Array<{
    station: string;
    load: number;
  }>;
}

export class LandPredictionResponseDto {
  @ApiProperty({ example: 'cmmi83qoc00000kirq90ord' })
  orderId: string;

  @ApiProperty({ example: 'Мангистау — Жанаозен' })
  title: string;

  @ApiProperty({ example: 'Актау' })
  origin: string;

  @ApiProperty({ example: 'Жанаозен' })
  destination: string;

  @ApiProperty({ example: 'wait' })
  recommendation: string;

  @ApiProperty({ example: 'high' })
  riskLevel: string;

  @ApiProperty({ example: '2026-06-13T08:00:00.000Z' })
  bestDepartureTime: string;

  @ApiProperty({ example: 140 })
  expectedDelayMinutes: number;

  @ApiProperty({
    example: 'Высокая загруженность КПП Темир Баба и ожидаются осадки.',
  })
  shortExplanation: string;

  @ApiProperty({ type: LandPredictionDataDto })
  data: LandPredictionDataDto;

  @ApiProperty({ example: 'rule' })
  source: string;

  @ApiProperty({ example: '2026-06-13T08:00:00.000Z' })
  generatedAt: string;
}

export class LandPredictionListResponseDto {
  @ApiProperty({ type: [LandPredictionResponseDto] })
  predictions: LandPredictionResponseDto[];
}