import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { ErrorResponseDto } from '../../common/dto/error-response.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RouteConditionsService } from '../services/route-conditions.service';

@Controller('route-conditions')
@ApiTags('Route Conditions')
@ApiBearerAuth('bearer')
@UseGuards(JwtAuthGuard)
@ApiUnauthorizedResponse({
  type: ErrorResponseDto,
  description: 'Unauthorized',
})
export class RouteConditionsController {
  constructor(
    private readonly routeConditionsService: RouteConditionsService,
  ) {}

  @Get(':orderId')
  @ApiOperation({
    summary: 'Route conditions for an order',
    description:
      'Дистанция, ETA, погода по маршруту и предупреждения (жара/пыль/дождь/ветер). Погода доступна, когда задан OPENWEATHER_API_KEY.',
  })
  @ApiOkResponse({
    schema: {
      type: 'object',
      properties: {
        distanceKm: { type: 'number' },
        durationMinutes: { type: 'number' },
        etaMinutes: { type: 'number' },
        weatherAvailable: { type: 'boolean' },
        warnings: { type: 'array' },
      },
    },
  })
  @ApiNotFoundResponse({
    type: ErrorResponseDto,
    description: 'Order not found',
  })
  getForOrder(@Param('orderId') orderId: string) {
    return this.routeConditionsService.getForOrder(orderId);
  }
}
