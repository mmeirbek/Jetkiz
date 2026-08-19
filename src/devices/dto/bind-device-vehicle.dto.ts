import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class BindDeviceVehicleDto {
  @ApiPropertyOptional({
    example: 'vehicle-id',
    nullable: true,
    description: 'Vehicle to bind the device to, or null to unbind',
  })
  @IsOptional()
  @IsString()
  vehicleId?: string | null;
}
