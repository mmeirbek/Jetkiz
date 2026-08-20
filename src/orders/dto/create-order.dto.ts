import { ApiProperty } from '@nestjs/swagger';
import { Transform, Type, type TransformFnParams } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';

const trimString = ({ value }: TransformFnParams): unknown =>
  typeof value === 'string' ? value.trim() : value;

const trimStringArray = ({ value }: TransformFnParams): unknown =>
  Array.isArray(value)
    ? value.map((item: unknown) =>
        typeof item === 'string' ? item.trim() : item,
      )
    : value;

export class CreateOrderDto {
  @ApiProperty({ example: 'Transport construction materials to Kuryk' })
  @Transform(trimString)
  @IsString()
  @MaxLength(200)
  title: string;

  @ApiProperty({ example: 'CONSTRUCTION_MATERIALS' })
  @Transform(trimString)
  @IsString()
  @MaxLength(100)
  cargoType: string;

  @ApiProperty({ example: 12.5, minimum: 0 })
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  weight: number;

  @ApiProperty({ example: 42, minimum: 0 })
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  volume: number;

  @ApiProperty({
    example: true,
    required: false,
    description: 'Requires a refrigerated vehicle',
  })
  @IsOptional()
  @IsBoolean()
  isReefer?: boolean;

  @ApiProperty({ example: -18, required: false, description: 'Min temp in °C' })
  @Type(() => Number)
  @IsOptional()
  @IsNumber()
  @Min(-100)
  @Max(100)
  tempMin?: number;

  @ApiProperty({ example: 4, required: false, description: 'Max temp in °C' })
  @Type(() => Number)
  @IsOptional()
  @IsNumber()
  @Min(-100)
  @Max(100)
  tempMax?: number;

  @ApiProperty({
    example: 'aktau',
    required: false,
    description:
      'Settlement id from GET /settlements. When set, origin and coordinates are resolved by the server.',
  })
  @Transform(trimString)
  @IsOptional()
  @IsString()
  @MaxLength(100)
  originSettlementId?: string;

  @ApiProperty({ example: 'Aktau' })
  @ValidateIf((dto: CreateOrderDto) => !dto.originSettlementId)
  @Transform(trimString)
  @IsString()
  @MaxLength(200)
  origin?: string;

  @ApiProperty({ example: 'Aktau', required: false })
  @Transform(trimString)
  @IsOptional()
  @IsString()
  @MaxLength(100)
  originCity?: string;

  @ApiProperty({ example: 'Kazakhstan', required: false })
  @Transform(trimString)
  @IsOptional()
  @IsString()
  @MaxLength(100)
  originCountry?: string;

  @ApiProperty({
    example: 'kuryk',
    required: false,
    description:
      'Settlement id from GET /settlements. When set, destination and coordinates are resolved by the server.',
  })
  @Transform(trimString)
  @IsOptional()
  @IsString()
  @MaxLength(100)
  destinationSettlementId?: string;

  @ApiProperty({ example: 'Kuryk Port' })
  @ValidateIf((dto: CreateOrderDto) => !dto.destinationSettlementId)
  @Transform(trimString)
  @IsString()
  @MaxLength(200)
  destination?: string;

  @ApiProperty({ example: 'Kuryk', required: false })
  @Transform(trimString)
  @IsOptional()
  @IsString()
  @MaxLength(100)
  destinationCity?: string;

  @ApiProperty({ example: 'Kazakhstan', required: false })
  @Transform(trimString)
  @IsOptional()
  @IsString()
  @MaxLength(100)
  destinationCountry?: string;

  @ApiProperty({ example: 43.6532 })
  @ValidateIf((dto: CreateOrderDto) => !dto.originSettlementId)
  @Type(() => Number)
  @IsNumber()
  @Min(-90)
  @Max(90)
  originLat?: number;

  @ApiProperty({ example: 51.1975 })
  @ValidateIf((dto: CreateOrderDto) => !dto.originSettlementId)
  @Type(() => Number)
  @IsNumber()
  @Min(-180)
  @Max(180)
  originLng?: number;

  @ApiProperty({ example: 43.1789 })
  @ValidateIf((dto: CreateOrderDto) => !dto.destinationSettlementId)
  @Type(() => Number)
  @IsNumber()
  @Min(-90)
  @Max(90)
  destinationLat?: number;

  @ApiProperty({ example: 51.6814 })
  @ValidateIf((dto: CreateOrderDto) => !dto.destinationSettlementId)
  @Type(() => Number)
  @IsNumber()
  @Min(-180)
  @Max(180)
  destinationLng?: number;

  @ApiProperty({
    example: 'https://cdn.example.com/orders/cargo-photo.jpg',
    required: false,
  })
  @Transform(trimString)
  @IsOptional()
  @IsString()
  @MaxLength(2048)
  cargoPhotoUrl?: string;

  @ApiProperty({
    example: [
      'https://cdn.example.com/orders/photo-1.jpg',
      'https://cdn.example.com/orders/photo-2.jpg',
    ],
    required: false,
    type: [String],
  })
  @Transform(trimStringArray)
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  @MaxLength(2048, { each: true })
  productPhotoUrls?: string[];

  @ApiProperty({ example: 'Requires covered truck', required: false })
  @Transform(trimString)
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  comment?: string;

  @ApiProperty({ example: 180000, minimum: 0, required: false })
  @Type(() => Number)
  @IsOptional()
  @IsNumber()
  @Min(0)
  estimatedPrice?: number;

  @ApiProperty({
    example: 8,
    minimum: 0,
    maximum: 100000,
    required: false,
    description: 'Estimated delivery time in hours',
  })
  @Type(() => Number)
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100000)
  estimatedDeliveryTime?: number;

  @ApiProperty({
    example: 120,
    minimum: 0,
    maximum: 100000,
    required: false,
    description: 'Estimated carrier search time in minutes',
  })
  @Type(() => Number)
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100000)
  estimatedCarrierSearchTime?: number;
}
