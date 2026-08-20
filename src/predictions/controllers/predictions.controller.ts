import {
  Body,
  Controller,
  Get,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBadGatewayResponse,
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { Public } from '../../common/decorators/public.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import type { AuthUser } from '../../common/types/auth-user.type';
import { ErrorResponseDto } from '../../common/dto/error-response.dto';
import {
  LandPredictionListResponseDto,
  LandPredictionRequestDto,
  LandPredictionResponseDto,
} from '../dto/land-prediction.dto';
import {
  MarinePredictionRequestDto,
  MarinePredictionResponseDto,
} from '../dto/marine-prediction.dto';
import { PredictionsService } from '../services/predictions.service';

@Controller('predictions')
@ApiTags('Predictions')
export class PredictionsController {
  constructor(private readonly predictionsService: PredictionsService) {}

  @Get('land')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('bearer')
  @ApiOperation({
    summary:
      'List automatically generated land predictions for the current user',
  })
  @ApiOkResponse({ type: LandPredictionListResponseDto })
  @ApiUnauthorizedResponse({ type: ErrorResponseDto })
  list(@CurrentUser() authUser: AuthUser) {
    return this.predictionsService.listForUser(authUser);
  }

  @Post('land')
  @Public()
  @ApiOperation({
    summary: 'Get a land route logistics prediction for an order',
  })
  @ApiCreatedResponse({ type: LandPredictionResponseDto })
  @ApiBadRequestResponse({ type: ErrorResponseDto })
  @ApiBadGatewayResponse({ type: ErrorResponseDto })
  predictLand(@Body() dto: LandPredictionRequestDto) {
    return this.predictionsService.predictLand(dto.orderId);
  }

  @Post('marine')
  @ApiOperation({ summary: 'Get a marine route logistics prediction (stub)' })
  @ApiCreatedResponse({ type: MarinePredictionResponseDto })
  @ApiBadRequestResponse({ type: ErrorResponseDto })
  predictMarine(@Body() dto: MarinePredictionRequestDto) {
    return this.predictionsService.predictMarine(
      dto.originLat,
      dto.originLng,
      dto.destLat,
      dto.destLng,
    );
  }
}