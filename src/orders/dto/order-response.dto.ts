import { ApiProperty } from '@nestjs/swagger';
import { OrderStatus } from '@prisma/client';

export class OrderResponseDto {
  @ApiProperty({ example: 'cmmi83qoc00000kirq90ord' })
  id: string;

  @ApiProperty({ example: 'cmmi83qoc00000kirq90usr' })
  clientId: string;

  @ApiProperty({ example: 'cmmi83qoc00000kirq90car', nullable: true })
  carrierId: string | null;

  @ApiProperty({ example: 'Transport construction materials to Kuryk' })
  title: string;

  @ApiProperty({ example: 'CONSTRUCTION_MATERIALS' })
  cargoType: string;

  @ApiProperty({ example: 12.5 })
  weight: number;

  @ApiProperty({ example: 42 })
  volume: number;

  @ApiProperty({ example: 'Aktau' })
  origin: string;

  @ApiProperty({ example: 'aktau', nullable: true })
  originSettlementId: string | null;

  @ApiProperty({ example: 'Aktau', nullable: true })
  originCity: string | null;

  @ApiProperty({ example: 'Kazakhstan', nullable: true })
  originCountry: string | null;

  @ApiProperty({ example: 'Kuryk Port' })
  destination: string;

  @ApiProperty({ example: 'kuryk', nullable: true })
  destinationSettlementId: string | null;

  @ApiProperty({ example: 'Kuryk', nullable: true })
  destinationCity: string | null;

  @ApiProperty({ example: 'Kazakhstan', nullable: true })
  destinationCountry: string | null;

  @ApiProperty({ example: 43.6532, nullable: true })
  originLat: number | null;

  @ApiProperty({ example: 51.1975, nullable: true })
  originLng: number | null;

  @ApiProperty({ example: 43.1789, nullable: true })
  destinationLat: number | null;

  @ApiProperty({ example: 51.6814, nullable: true })
  destinationLng: number | null;

  @ApiProperty({
    example: 'https://cdn.example.com/orders/cargo-photo.jpg',
    nullable: true,
  })
  cargoPhotoUrl: string | null;

  @ApiProperty({
    example: [
      'https://cdn.example.com/orders/photo-1.jpg',
      'https://cdn.example.com/orders/photo-2.jpg',
    ],
    type: [String],
  })
  productPhotoUrls: string[];

  @ApiProperty({ example: 'Requires covered truck', nullable: true })
  comment: string | null;

  @ApiProperty({ example: 180000, nullable: true })
  estimatedPrice: number | null;

  @ApiProperty({ example: 8, nullable: true })
  estimatedDeliveryTime: number | null;

  @ApiProperty({ example: 120, nullable: true })
  estimatedCarrierSearchTime: number | null;

  @ApiProperty({ enum: OrderStatus, example: OrderStatus.SEARCHING })
  status: OrderStatus;

  @ApiProperty({ example: '2026-06-11T04:18:44.902Z' })
  createdAt: Date;

  @ApiProperty({ example: '2026-06-11T04:18:44.902Z' })
  updatedAt: Date;
}

export class OrderEnvelopeResponseDto {
  @ApiProperty({ type: OrderResponseDto })
  order: OrderResponseDto;
}

export class OrderAssignmentResponseDto extends OrderEnvelopeResponseDto {
  @ApiProperty({ example: 20, description: 'Vehicle capacity in tons' })
  capacityTons: number;

  @ApiProperty({
    example: 19.2,
    description: 'Remaining free capacity in tons',
  })
  freeCapacityTons: number;
}

export class CalculatedRouteResponseDto {
  @ApiProperty({ example: 'cmmi83qoc00000kirq90rte' })
  id: string;

  @ApiProperty({ example: 141.4 })
  distanceKm: number;

  @ApiProperty({ example: 141 })
  durationMinutes: number;

  @ApiProperty({
    example: { type: 'LineString', coordinates: [[51.16, 43.65]] },
  })
  geometry: object;
}

export class OrderCreationResponseDto extends OrderEnvelopeResponseDto {
  @ApiProperty({ type: CalculatedRouteResponseDto, nullable: true })
  route: CalculatedRouteResponseDto | null;

  @ApiProperty({ example: true })
  routeCalculated: boolean;
}

export class OrdersListResponseDto {
  @ApiProperty({ type: [OrderResponseDto] })
  orders: OrderResponseDto[];
}
