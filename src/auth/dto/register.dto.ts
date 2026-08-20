import { ApiProperty } from '@nestjs/swagger';
import { Transform, type TransformFnParams } from 'class-transformer';
import {
  IsEmail,
  IsEnum,
  IsString,
  MaxLength,
  MinLength,
  IsOptional,
  IsBoolean,
  IsIn,
} from 'class-validator';
import { UserRole } from '@prisma/client';

const normalizeEmail = ({ value }: TransformFnParams): unknown =>
  typeof value === 'string' ? value.trim().toLowerCase() : value;

const normalizeTrimmedString = ({ value }: TransformFnParams): unknown =>
  typeof value === 'string' ? value.trim() : value;

export class RegisterDto {
  @ApiProperty({ example: 'client01@caspex.local' })
  @Transform(normalizeEmail)
  @IsEmail()
  @MaxLength(254)
  email: string;

  @ApiProperty({ example: 'CaspXPass_123' })
  @IsString()
  @MinLength(8)
  @MaxLength(128)
  password: string;

  @ApiProperty({
    enum: UserRole,
    example: UserRole.CLIENT,
    description: 'Public registration accepts CLIENT and CARRIER only',
  })
  @IsEnum(UserRole)
  role: UserRole;

  @ApiProperty({ example: 'Alibi' })
  @Transform(normalizeTrimmedString)
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  firstName: string;

  @ApiProperty({ example: 'Samatov' })
  @Transform(normalizeTrimmedString)
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  lastName: string;

  @ApiProperty({ example: '+77017777777' })
  @Transform(normalizeTrimmedString)
  @IsString()
  @MinLength(6)
  @MaxLength(25)
  phone: string;

  @ApiProperty({ example: true, description: 'Consent to personal data processing is required' })
  @IsBoolean()
  @IsIn([true])
  personalDataConsent: boolean;

  @ApiProperty({ example: true, description: 'Privacy policy consent is required' })
  @IsBoolean()
  @IsIn([true])
  privacyPolicyConsent: boolean;

  @ApiProperty({ example: 'https://example.com/avatar.jpg', required: false })
  @IsOptional()
  @IsString()
  avatarUrl?: string;

  @ApiProperty({ example: 'Mangystau Trans LLC', required: false })
  @IsOptional()
  @IsString()
  companyName?: string;

  @ApiProperty({ example: 'https://example.com/logo.png', required: false })
  @IsOptional()
  @IsString()
  companyLogo?: string;

  @ApiProperty({ example: 'Aktau', required: false })
  @IsOptional()
  @IsString()
  city?: string;

  @ApiProperty({ example: 'Kazakhstan', required: false })
  @IsOptional()
  @IsString()
  country?: string;
}
