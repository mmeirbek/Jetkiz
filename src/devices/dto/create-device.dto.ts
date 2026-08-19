import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, type TransformFnParams } from 'class-transformer';
import { IsOptional, IsString, MaxLength } from 'class-validator';

const trimString = ({ value }: TransformFnParams): unknown =>
  typeof value === 'string' ? value.trim() : value;

export class CreateDeviceDto {
  @ApiProperty({ example: 'Truck GPS tracker' })
  @Transform(trimString)
  @IsString()
  @MaxLength(100)
  name: string;

  @ApiPropertyOptional({
    example: 'vehicle-id',
    nullable: true,
    description: 'Vehicle to bind the device to',
  })
  @Transform(trimString)
  @IsOptional()
  @IsString()
  vehicleId?: string;
}
