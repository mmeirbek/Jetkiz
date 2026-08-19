import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { ErrorResponseDto } from '../../common/dto/error-response.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import type { AuthUser } from '../../common/types/auth-user.type';
import { BindDeviceVehicleDto } from '../dto/bind-device-vehicle.dto';
import { CreateDeviceDto } from '../dto/create-device.dto';
import {
  DeviceEnvelopeResponseDto,
  DeviceWithSecretEnvelopeResponseDto,
  DevicesListResponseDto,
} from '../dto/device-response.dto';
import { DevicesService } from '../services/devices.service';

@Controller('devices')
@ApiTags('Devices')
@ApiBearerAuth('bearer')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.SUPERADMIN, UserRole.CARRIER)
@ApiUnauthorizedResponse({
  type: ErrorResponseDto,
  description: 'Unauthorized',
})
@ApiForbiddenResponse({ type: ErrorResponseDto, description: 'Forbidden' })
export class DevicesController {
  constructor(private readonly devicesService: DevicesService) {}

  @Post()
  @ApiOperation({ summary: 'Create a device, returns the secret once' })
  @ApiCreatedResponse({ type: DeviceWithSecretEnvelopeResponseDto })
  @ApiBadRequestResponse({
    type: ErrorResponseDto,
    description: 'Invalid payload',
  })
  @ApiConflictResponse({
    type: ErrorResponseDto,
    description: 'Vehicle already bound to another device',
  })
  @ApiNotFoundResponse({
    type: ErrorResponseDto,
    description: 'Vehicle not found',
  })
  create(@CurrentUser() authUser: AuthUser, @Body() dto: CreateDeviceDto) {
    return this.devicesService.create(authUser, dto);
  }

  @Get()
  @ApiOperation({ summary: 'List devices' })
  @ApiOkResponse({ type: DevicesListResponseDto })
  list(@CurrentUser() authUser: AuthUser) {
    return this.devicesService.list(authUser);
  }

  @Patch(':id/vehicle')
  @ApiOperation({ summary: 'Bind or unbind a device to a vehicle' })
  @ApiOkResponse({ type: DeviceEnvelopeResponseDto })
  @ApiBadRequestResponse({
    type: ErrorResponseDto,
    description: 'Invalid payload',
  })
  @ApiConflictResponse({
    type: ErrorResponseDto,
    description: 'Vehicle already bound to another device',
  })
  @ApiNotFoundResponse({
    type: ErrorResponseDto,
    description: 'Device or vehicle not found',
  })
  bindVehicle(
    @CurrentUser() authUser: AuthUser,
    @Param('id') deviceId: string,
    @Body() dto: BindDeviceVehicleDto,
  ) {
    return this.devicesService.bindVehicle(authUser, deviceId, dto);
  }

  @Post(':id/rotate-secret')
  @ApiOperation({
    summary: 'Rotate device secret, returns the new secret once',
  })
  @ApiOkResponse({ type: DeviceWithSecretEnvelopeResponseDto })
  @ApiNotFoundResponse({
    type: ErrorResponseDto,
    description: 'Device not found',
  })
  rotateSecret(
    @CurrentUser() authUser: AuthUser,
    @Param('id') deviceId: string,
  ) {
    return this.devicesService.rotateSecret(authUser, deviceId);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a device' })
  @ApiOkResponse({ type: DeviceEnvelopeResponseDto })
  @ApiNotFoundResponse({
    type: ErrorResponseDto,
    description: 'Device not found',
  })
  remove(@CurrentUser() authUser: AuthUser, @Param('id') deviceId: string) {
    return this.devicesService.remove(authUser, deviceId);
  }
}
