import { Controller, Get, Param } from '@nestjs/common';
import {
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { Public } from '../../common/decorators/public.decorator';
import { ErrorResponseDto } from '../../common/dto/error-response.dto';
import {
  SettlementEnvelopeResponseDto,
  SettlementsListResponseDto,
} from '../dto/settlement-response.dto';
import { SettlementsService } from '../services/settlements.service';

@Controller('settlements')
@ApiTags('Settlements')
export class SettlementsController {
  constructor(private readonly settlementsService: SettlementsService) {}

  @Get()
  @Public()
  @ApiOperation({ summary: 'List Mangystau settlements for orders and maps' })
  @ApiOkResponse({ type: SettlementsListResponseDto })
  findAll() {
    return this.settlementsService.findAll();
  }

  @Get(':id')
  @Public()
  @ApiOperation({ summary: 'Get a Mangystau settlement by dataset id' })
  @ApiOkResponse({ type: SettlementEnvelopeResponseDto })
  @ApiNotFoundResponse({ type: ErrorResponseDto })
  findOne(@Param('id') id: string) {
    return this.settlementsService.findOne(id);
  }
}
