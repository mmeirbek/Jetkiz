import { Controller, Get, Query, ValidationPipe } from '@nestjs/common';
import {
  ApiOkResponse,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { Public } from '../common/decorators/public.decorator';
import { GeocodeService } from './geocode.service';

@Controller('geocode')
@ApiTags('Geocode')
@Public()
export class GeocodeController {
  constructor(private readonly geocodeService: GeocodeService) {}

  @Get()
  @ApiOperation({
    summary: 'Geocode an arbitrary address/text into coordinates',
  })
  @ApiQuery({ name: 'q', required: true, description: 'Address or place name' })
  @ApiOkResponse({
    schema: {
      type: 'object',
      properties: {
        results: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              label: { type: 'string' },
              latitude: { type: 'number' },
              longitude: { type: 'number' },
              settlementId: { type: 'string', nullable: true },
              source: { enum: ['local', 'osm'] },
            },
          },
        },
      },
    },
  })
  async geocode(
    @Query('q', new ValidationPipe({ transform: true })) q: string,
  ) {
    const results = await this.geocodeService.search(q ?? '');
    return { results };
  }
}