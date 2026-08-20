import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CarrierRoutePlanOrderDto {
  @ApiProperty({ example: 'cmmi83qoc00000kirq90ord' })
  id: string;

  @ApiProperty({ example: 'Стройматериалы в Жанаозен' })
  title: string;

  @ApiProperty({ example: 'Aktau' })
  origin: string;

  @ApiProperty({ example: 'Zhanaozen' })
  destination: string;

  @ApiProperty({ example: 500 })
  weight: number;

  @ApiProperty({ example: 5 })
  volume: number;
}

export class CarrierRoutePlanStopDto {
  @ApiProperty({ example: 'cmmi83qoc00000kirq90ord' })
  orderId: string;

  @ApiProperty({ enum: ['pickup', 'delivery'] })
  action: 'pickup' | 'delivery';

  @ApiProperty({ example: 43.65 })
  lat: number;

  @ApiProperty({ example: 51.17 })
  lng: number;
}

export class CarrierRoutePlanVehicleDto {
  @ApiProperty({ example: 'veh_01' })
  id: string;

  @ApiProperty({ example: '001AAA01' })
  plateNumber: string;

  @ApiProperty({ example: 20 })
  capacityTons: number;
}

export class CarrierRoutePlanResponseDto {
  @ApiProperty({ type: [CarrierRoutePlanOrderDto] })
  orders: CarrierRoutePlanOrderDto[];

  @ApiProperty({ type: CarrierRoutePlanVehicleDto, nullable: true })
  vehicle: CarrierRoutePlanVehicleDto | null;

  @ApiProperty({ example: 20 })
  capacityTons: number;

  @ApiProperty({ example: 18.4 })
  freeTons: number;

  @ApiProperty({ example: 42.6, description: 'Estimated fuel saved in liters' })
  savedFuelLiters: number;

  @ApiProperty({ example: 19170, description: 'Estimated fuel cost saved in tenge' })
  savedMoneyTenge: number;

  @ApiProperty({ example: 36, description: 'Estimated empty mileage reduced in kilometers' })
  savedEmptyKm: number;

  @ApiProperty({ example: 0.6, description: 'Estimated hours saved' })
  savedHours: number;

  @ApiPropertyOptional({ nullable: true })
  route: {
    distanceKm: number;
    durationMinutes: number;
    geometry: object;
  } | null;

  @ApiProperty({ type: [CarrierRoutePlanStopDto] })
  stops: CarrierRoutePlanStopDto[];

  @ApiProperty({
    type: [String],
    description: 'Order ids in recommended pickup order',
  })
  sequence: string[];

  @ApiProperty({ enum: ['vroom', 'greedy', 'none'] })
  strategy: 'vroom' | 'greedy' | 'none';
}
