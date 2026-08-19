import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import {
  ApiBadGatewayResponse,
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ErrorResponseDto } from '../../common/dto/error-response.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import type { AuthUser } from '../../common/types/auth-user.type';
import {
  CalculateRouteDto,
  CalculateRouteResponseDto,
} from '../dto/calculate-route.dto';
import { RoutesService } from '../services/routes.service';

@Controller('routes')
@ApiTags('Routes')
@ApiBearerAuth('bearer')
@UseGuards(JwtAuthGuard)
@ApiUnauthorizedResponse({
  type: ErrorResponseDto,
  description: 'Unauthorized',
})
export class RoutesController {
  constructor(private readonly routesService: RoutesService) {}

  @Post('calculate')
  @ApiOperation({
    summary:
      'Calculate a route with VROOM (OpenRouteService-backed) and return optimized route geometry as JSON',
  })
  @ApiCreatedResponse({ type: CalculateRouteResponseDto })
  @ApiBadRequestResponse({
    type: ErrorResponseDto,
    description: 'Coordinates are missing or order has no coordinates',
  })
  @ApiForbiddenResponse({
    type: ErrorResponseDto,
    description: 'Order is not available for this user',
  })
  @ApiNotFoundResponse({
    type: ErrorResponseDto,
    description: 'Order not found',
  })
  @ApiBadGatewayResponse({
    type: ErrorResponseDto,
    description:
      'VROOM/OpenRouteService request failed or returned invalid data',
  })
  calculate(@CurrentUser() authUser: AuthUser, @Body() dto: CalculateRouteDto) {
    return this.routesService.calculate(authUser, dto);
  }
}
