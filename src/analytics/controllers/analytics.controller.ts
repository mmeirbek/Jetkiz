import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiQuery,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { ErrorResponseDto } from '../../common/dto/error-response.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { AnalyticsService } from '../services/analytics.service';

@Controller('analytics')
@ApiTags('Analytics')
@ApiBearerAuth('bearer')
@UseGuards(JwtAuthGuard)
@ApiUnauthorizedResponse({
  type: ErrorResponseDto,
  description: 'Unauthorized',
})
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Get('flows')
  @ApiOperation({
    summary: 'Cargo flows between settlements',
    description:
      'Грузопотоки «откуда → куда»: число заявок, суммарный вес и объём. Опционально за последние N дней.',
  })
  @ApiQuery({
    name: 'days',
    required: false,
    example: 30,
    description: 'Период в днях (без параметра — все данные)',
  })
  @ApiOkResponse({
    schema: {
      type: 'object',
      properties: {
        flows: { type: 'array' },
        totalOrders: { type: 'number' },
        totalWeight: { type: 'number' },
        totalVolume: { type: 'number' },
        periodDays: { type: 'number', nullable: true },
        generatedAt: { type: 'string' },
      },
    },
  })
  flows(@Query('days') days?: string) {
    return this.analyticsService.flows(days ? Number(days) : undefined);
  }

  @Get('regional-summary')
  @ApiOperation({
    summary: 'Regional logistics summary',
    description:
      'Сводка по региону: заказы, активные рейсы, машины, километраж.',
  })
  regionalSummary() {
    return this.analyticsService.regionalSummary();
  }

  @Get('economic')
  @ApiOperation({
    summary: 'Economic impact',
    description:
      'Экономия: пустой пробег, топливо и деньги при использовании платформы (vs базлайн ~40% порожнего пробега).',
  })
  economic() {
    return this.analyticsService.economic();
  }
}
