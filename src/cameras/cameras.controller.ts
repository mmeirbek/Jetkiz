import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import type { AuthUser } from '../common/types/auth-user.type';
import { CamerasService } from './cameras.service';

@Controller('cameras')
@ApiTags('Cameras')
@ApiBearerAuth('bearer')
@UseGuards(JwtAuthGuard)
export class CamerasController {
  constructor(private readonly camerasService: CamerasService) {}

  @Get('orders/:id/latest')
  @ApiOkResponse({ description: 'Latest snapshot for a visible order' })
  latestForOrder(@CurrentUser() user: AuthUser, @Param('id') orderId: string) {
    return this.camerasService.latestForOrder(user, orderId);
  }

  @Get('devices/:id/latest')
  @ApiOkResponse({ description: 'Latest snapshot for a visible device' })
  latestForDevice(
    @CurrentUser() user: AuthUser,
    @Param('id') deviceId: string,
  ) {
    return this.camerasService.latestForDevice(user, deviceId);
  }
}
