import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
} from 'class-validator';
import { Metric, RuleOperator, Severity } from '@prisma/client';

export class UpdateAlertRuleDto {
  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  deviceId?: string;

  @ApiPropertyOptional({ enum: Metric })
  @IsOptional()
  @IsEnum(Metric)
  metric?: Metric;

  @ApiPropertyOptional({ enum: RuleOperator })
  @IsOptional()
  @IsEnum(RuleOperator)
  operator?: RuleOperator;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  threshold?: number;

  @ApiPropertyOptional({ enum: Severity })
  @IsOptional()
  @IsEnum(Severity)
  severity?: Severity;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
