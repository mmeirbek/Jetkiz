import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEnum,
  IsISO8601,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';
import { AlertStatus } from '@prisma/client';
import { Type } from 'class-transformer';

export class ListAlertsQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  deviceId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  vehicleId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  orderId?: string;

  @ApiPropertyOptional({ enum: AlertStatus })
  @IsOptional()
  @IsEnum(AlertStatus)
  status?: AlertStatus;

  @ApiPropertyOptional({ description: 'Filter by createdAt >= from (ISO8601)' })
  @IsOptional()
  @IsISO8601()
  from?: string;

  @ApiPropertyOptional({ description: 'Filter by createdAt <= to (ISO8601)' })
  @IsOptional()
  @IsISO8601()
  to?: string;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  skip?: number;

  @ApiPropertyOptional({ default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(100)
  take?: number;
}
