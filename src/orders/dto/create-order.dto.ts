import { ApiProperty } from '@nestjs/swagger';
import { Transform, Type, type TransformFnParams } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
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

  @ApiProperty({ example: 'Aktau' })
  @Transform(trimString)
  @IsString()
  @MaxLength(200)
  origin: string;

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

  @ApiProperty({ example: 'Kuryk Port' })
  @Transform(trimString)
  @IsString()
  @MaxLength(200)
  destination: string;

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
  @Type(() => Number)
  @IsNumber()
  @Min(-90)
  @Max(90)
  originLat: number;

  @ApiProperty({ example: 51.1975 })
  @Type(() => Number)
  @IsNumber()
  @Min(-180)
  @Max(180)
  originLng: number;

  @ApiProperty({ example: 43.1789 })
  @Type(() => Number)
  @IsNumber()
  @Min(-90)
  @Max(90)
  destinationLat: number;

  @ApiProperty({ example: 51.6814 })
  @Type(() => Number)
  @IsNumber()
  @Min(-180)
  @Max(180)
  destinationLng: number;

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
