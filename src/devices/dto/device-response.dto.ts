import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { DeviceStatus } from '@prisma/client';

export class DeviceResponseDto {
  @ApiProperty({ example: 'cmmi83qoc00000kirq90dev' })
  id: string;

  @ApiProperty({ example: 'Truck GPS tracker' })
  name: string;

  @ApiProperty({ enum: DeviceStatus, example: DeviceStatus.ACTIVE })
  status: DeviceStatus;

  @ApiProperty({ nullable: true, example: 'cmmi83qoc00000kirq90veh' })
  vehicleId: string | null;

  @ApiProperty({ nullable: true, example: 45.3215 })
  lastLat: number | null;

  @ApiProperty({ nullable: true, example: 51.1025 })
  lastLng: number | null;

  @ApiProperty({ nullable: true, example: '2026-08-19T10:00:00.000Z' })
  lastSeenAt: Date | null;

  @ApiProperty({ example: '2026-08-19T10:00:00.000Z' })
  createdAt: Date;
}

export class DeviceEnvelopeResponseDto {
  @ApiProperty({ type: DeviceResponseDto })
  device: DeviceResponseDto;
}

export class DeviceWithSecretResponseDto extends DeviceResponseDto {
  @ApiPropertyOptional({
    example: 'x8s9...',
    description: 'Secret is only returned once on create/rotate',
  })
  secret?: string;
}

export class DeviceWithSecretEnvelopeResponseDto {
  @ApiProperty({ type: DeviceWithSecretResponseDto })
  device: DeviceWithSecretResponseDto;
}

export class DevicesListResponseDto {
  @ApiProperty({ type: [DeviceResponseDto] })
  devices: DeviceResponseDto[];
}
