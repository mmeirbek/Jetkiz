import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
} from 'class-validator';
import { Metric, RuleOperator, Severity } from '@prisma/client';

export class CreateAlertRuleDto {
  @ApiPropertyOptional({
    example: 'device-id',
    nullable: true,
    description:
      'Device the rule applies to. Omit for a global rule (SUPERADMIN only)',
  })
  @IsOptional()
  @IsString()
  deviceId?: string;

  @ApiProperty({ enum: Metric, example: Metric.TEMPERATURE })
  @IsEnum(Metric)
  metric: Metric;

  @ApiProperty({ enum: RuleOperator, example: RuleOperator.GT })
  @IsEnum(RuleOperator)
  operator: RuleOperator;

  @ApiProperty({ example: 24 })
  @IsNumber()
  threshold: number;

  @ApiPropertyOptional({ enum: Severity, default: Severity.WARNING })
  @IsOptional()
  @IsEnum(Severity)
  severity?: Severity;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
