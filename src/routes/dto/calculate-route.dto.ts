import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type, type TransformFnParams } from 'class-transformer';
import {
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

const trimString = ({ value }: TransformFnParams): unknown =>
  typeof value === 'string' ? value.trim() : value;

export class CalculateRouteDto {
  @ApiPropertyOptional({
    example: 'cmmi83qoc00000kirq90ord',
    description:
      'Order id. If coordinates are omitted, origin/destination coordinates are taken from the order.',
  })
  @Transform(trimString)
  @IsOptional()
  @IsString()
  @MaxLength(50)
  orderId?: string;

  @ApiPropertyOptional({ example: 43.65 })
  @Type(() => Number)
  @IsOptional()
  @IsNumber()
  @Min(-90)
  @Max(90)
  startLat?: number;

  @ApiPropertyOptional({ example: 51.17 })
  @Type(() => Number)
  @IsOptional()
  @IsNumber()
  @Min(-180)
  @Max(180)
  startLng?: number;

  @ApiPropertyOptional({ example: 40.37 })
  @Type(() => Number)
  @IsOptional()
  @IsNumber()
  @Min(-90)
  @Max(90)
  endLat?: number;

  @ApiPropertyOptional({ example: 49.89 })
  @Type(() => Number)
  @IsOptional()
  @IsNumber()
  @Min(-180)
  @Max(180)
  endLng?: number;
}

export class RouteGeometryDto {
  @ApiProperty({ example: 'LineString' })
  type: string;

  @ApiProperty({
    type: 'array',
    items: {
      type: 'array',
      items: {
        type: 'number',
        format: 'double',
      },
      minItems: 2,
      maxItems: 2,
    },
    example: [
      [51.17, 43.65],
      [49.89, 40.37],
    ],
  })
  coordinates: number[][];
}

export class CalculateRouteResponseDto {
  @ApiProperty({ example: 'route_01', nullable: true })
  routeId: string | null;

  @ApiProperty({ example: 'cmmi83qoc00000kirq90ord', nullable: true })
  orderId: string | null;

  @ApiProperty({ example: 682.12 })
  distanceKm: number;

  @ApiProperty({ example: 740.54 })
  durationMinutes: number;

  @ApiProperty({ type: RouteGeometryDto })
  geometry: RouteGeometryDto;
}
