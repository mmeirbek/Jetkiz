import { ApiPropertyOptional } from '@nestjs/swagger';
import { OrderStatus } from '@prisma/client';
import { Transform, Type, type TransformFnParams } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsEnum,
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

export class UpdateSuperadminOrderDto {
  @ApiPropertyOptional({ example: 'Transport construction materials to Kuryk' })
  @Transform(trimString)
  @IsOptional()
  @IsString()
  @MaxLength(200)
  title?: string;

  @ApiPropertyOptional({ example: 'CONSTRUCTION_MATERIALS' })
  @Transform(trimString)
  @IsOptional()
  @IsString()
  @MaxLength(100)
  cargoType?: string;

  @ApiPropertyOptional({ example: 12.5, minimum: 0 })
  @Type(() => Number)
  @IsOptional()
  @IsNumber()
  @Min(0)
  weight?: number;

  @ApiPropertyOptional({ example: 42, minimum: 0 })
  @Type(() => Number)
  @IsOptional()
  @IsNumber()
  @Min(0)
  volume?: number;

  @ApiPropertyOptional({ example: 'Aktau' })
  @Transform(trimString)
  @IsOptional()
  @IsString()
  @MaxLength(200)
  origin?: string;

  @ApiPropertyOptional({ example: 'Aktau' })
  @Transform(trimString)
  @IsOptional()
  @IsString()
  @MaxLength(100)
  originCity?: string;

  @ApiPropertyOptional({ example: 'Kazakhstan' })
  @Transform(trimString)
  @IsOptional()
  @IsString()
  @MaxLength(100)
  originCountry?: string;

  @ApiPropertyOptional({ example: 'Kuryk Port' })
  @Transform(trimString)
  @IsOptional()
  @IsString()
  @MaxLength(200)
  destination?: string;

  @ApiPropertyOptional({ example: 'Kuryk' })
  @Transform(trimString)
  @IsOptional()
  @IsString()
  @MaxLength(100)
  destinationCity?: string;

  @ApiPropertyOptional({ example: 'Kazakhstan' })
  @Transform(trimString)
  @IsOptional()
  @IsString()
  @MaxLength(100)
  destinationCountry?: string;

  @ApiPropertyOptional({ example: 43.6532, minimum: -90, maximum: 90 })
  @Type(() => Number)
  @IsOptional()
  @IsNumber()
  @Min(-90)
  @Max(90)
  originLat?: number;

  @ApiPropertyOptional({ example: 51.1975, minimum: -180, maximum: 180 })
  @Type(() => Number)
  @IsOptional()
  @IsNumber()
  @Min(-180)
  @Max(180)
  originLng?: number;

  @ApiPropertyOptional({ example: 43.1789, minimum: -90, maximum: 90 })
  @Type(() => Number)
  @IsOptional()
  @IsNumber()
  @Min(-90)
  @Max(90)
  destinationLat?: number;

  @ApiPropertyOptional({ example: 51.6814, minimum: -180, maximum: 180 })
  @Type(() => Number)
  @IsOptional()
  @IsNumber()
  @Min(-180)
  @Max(180)
  destinationLng?: number;

  @ApiPropertyOptional({
    example: 'https://cdn.example.com/orders/cargo-photo.jpg',
  })
  @Transform(trimString)
  @IsOptional()
  @IsString()
  @MaxLength(2048)
  cargoPhotoUrl?: string;

  @ApiPropertyOptional({
    example: [
      'https://cdn.example.com/orders/photo-1.jpg',
      'https://cdn.example.com/orders/photo-2.jpg',
    ],
    type: [String],
  })
  @Transform(({ value }: TransformFnParams): unknown =>
    Array.isArray(value)
      ? value.map((item: unknown) =>
          typeof item === 'string' ? item.trim() : item,
        )
      : value,
  )
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  @MaxLength(2048, { each: true })
  productPhotoUrls?: string[];

  @ApiPropertyOptional({ example: 'Requires covered truck' })
  @Transform(trimString)
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  comment?: string;

  @ApiPropertyOptional({ example: 180000, minimum: 0 })
  @Type(() => Number)
  @IsOptional()
  @IsNumber()
  @Min(0)
  estimatedPrice?: number;

  @ApiPropertyOptional({ example: 8, minimum: 0, maximum: 100000 })
  @Type(() => Number)
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100000)
  estimatedDeliveryTime?: number;

  @ApiPropertyOptional({ example: 120, minimum: 0, maximum: 100000 })
  @Type(() => Number)
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100000)
  estimatedCarrierSearchTime?: number;

  @ApiPropertyOptional({ enum: OrderStatus, example: OrderStatus.ASSIGNED })
  @IsOptional()
  @IsEnum(OrderStatus)
  status?: OrderStatus;

  @ApiPropertyOptional({
    example: 'cmmi83qoc00000kirq90car',
    nullable: true,
  })
  @Transform(trimString)
  @IsOptional()
  @IsString()
  @MaxLength(50)
  carrierId?: string | null;
}
