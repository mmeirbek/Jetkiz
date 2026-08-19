import { Body, Controller, Post } from '@nestjs/common';
import {
  ApiBadGatewayResponse,
  ApiBadRequestResponse,
  ApiCreatedResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { Public } from '../../common/decorators/public.decorator';
import { ErrorResponseDto } from '../../common/dto/error-response.dto';
import {
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
@Public()
export class PredictionsController {
  constructor(private readonly predictionsService: PredictionsService) {}

  @Post('land')
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
