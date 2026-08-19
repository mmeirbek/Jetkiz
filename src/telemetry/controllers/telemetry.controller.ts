import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ErrorResponseDto } from '../../common/dto/error-response.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import type { AuthUser } from '../../common/types/auth-user.type';
import { TelemetryHistoryQueryDto } from '../dto/telemetry-history-query.dto';
import {
  TelemetryEnvelopeResponseDto,
  TelemetryHistoryResponseDto,
} from '../dto/telemetry-response.dto';
import { TelemetryService } from '../services/telemetry.service';

@Controller('telemetry')
@ApiTags('Telemetry')
@ApiBearerAuth('bearer')
@UseGuards(JwtAuthGuard)
@ApiUnauthorizedResponse({
  type: ErrorResponseDto,
  description: 'Unauthorized',
})
export class TelemetryController {
  constructor(private readonly telemetryService: TelemetryService) {}

  @Get('devices/:id/last')
  @ApiOperation({ summary: 'Latest telemetry point for a device' })
  @ApiOkResponse({ type: TelemetryEnvelopeResponseDto })
  @ApiNotFoundResponse({
    type: ErrorResponseDto,
    description: 'Device not found',
  })
  deviceLast(@CurrentUser() authUser: AuthUser, @Param('id') deviceId: string) {
    return this.telemetryService.getDeviceLast(authUser, deviceId);
  }

  @Get('devices/:id/history')
  @ApiOperation({ summary: 'Aggregated telemetry history for a device' })
  @ApiOkResponse({ type: TelemetryHistoryResponseDto })
  @ApiNotFoundResponse({
    type: ErrorResponseDto,
    description: 'Device not found',
  })
  deviceHistory(
    @CurrentUser() authUser: AuthUser,
    @Param('id') deviceId: string,
    @Query() query: TelemetryHistoryQueryDto,
  ) {
    return this.telemetryService.getDeviceHistory(authUser, deviceId, query);
  }

  @Get('vehicles/:id/last')
  @ApiOperation({ summary: 'Latest telemetry point for a vehicle' })
  @ApiOkResponse({ type: TelemetryEnvelopeResponseDto })
  @ApiNotFoundResponse({
    type: ErrorResponseDto,
    description: 'Vehicle not found',
  })
  vehicleLast(
    @CurrentUser() authUser: AuthUser,
    @Param('id') vehicleId: string,
  ) {
    return this.telemetryService.getVehicleLast(authUser, vehicleId);
  }

  @Get('vehicles/:id/history')
  @ApiOperation({ summary: 'Aggregated telemetry history for a vehicle' })
  @ApiOkResponse({ type: TelemetryHistoryResponseDto })
  @ApiNotFoundResponse({
    type: ErrorResponseDto,
    description: 'Vehicle not found',
  })
  vehicleHistory(
    @CurrentUser() authUser: AuthUser,
    @Param('id') vehicleId: string,
    @Query() query: TelemetryHistoryQueryDto,
  ) {
    return this.telemetryService.getVehicleHistory(authUser, vehicleId, query);
  }

  @Get('orders/:id/live')
  @ApiOperation({ summary: 'Latest telemetry point for an order' })
  @ApiOkResponse({ type: TelemetryEnvelopeResponseDto })
  @ApiNotFoundResponse({
    type: ErrorResponseDto,
    description: 'Order not found',
  })
  orderLive(@CurrentUser() authUser: AuthUser, @Param('id') orderId: string) {
    return this.telemetryService.getOrderLive(authUser, orderId);
  }

  @Get('orders/:id/history')
  @ApiOperation({ summary: 'Aggregated telemetry history for an order' })
  @ApiOkResponse({ type: TelemetryHistoryResponseDto })
  @ApiNotFoundResponse({
    type: ErrorResponseDto,
    description: 'Order not found',
  })
  orderHistory(
    @CurrentUser() authUser: AuthUser,
    @Param('id') orderId: string,
    @Query() query: TelemetryHistoryQueryDto,
  ) {
    return this.telemetryService.getOrderHistory(authUser, orderId, query);
  }
}
