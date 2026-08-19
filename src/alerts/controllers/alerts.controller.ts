import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ErrorResponseDto } from '../../common/dto/error-response.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '@prisma/client';
import type { AuthUser } from '../../common/types/auth-user.type';
import { CreateAlertRuleDto } from '../dto/create-alert-rule.dto';
import { ListAlertsQueryDto } from '../dto/list-alerts-query.dto';
import { UpdateAlertRuleDto } from '../dto/update-alert-rule.dto';
import { AlertsService } from '../services/alerts.service';

@Controller('alerts')
@ApiTags('Alerts')
@ApiBearerAuth('bearer')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiUnauthorizedResponse({
  type: ErrorResponseDto,
  description: 'Unauthorized',
})
@ApiForbiddenResponse({ type: ErrorResponseDto, description: 'Forbidden' })
export class AlertsController {
  constructor(private readonly alertsService: AlertsService) {}

  @Post('rules')
  @Roles(UserRole.SUPERADMIN, UserRole.CARRIER)
  @ApiOperation({ summary: 'Create a sensor alert rule' })
  @ApiCreatedResponse({ description: 'Rule created' })
  createRule(
    @CurrentUser() authUser: AuthUser,
    @Body() dto: CreateAlertRuleDto,
  ) {
    return this.alertsService.createRule(authUser, dto);
  }

  @Get('rules')
  @ApiOperation({ summary: 'List alert rules' })
  @ApiOkResponse({ description: 'List of rules' })
  listRules(@CurrentUser() authUser: AuthUser) {
    return this.alertsService.listRules(authUser);
  }

  @Patch('rules/:id')
  @Roles(UserRole.SUPERADMIN, UserRole.CARRIER)
  @ApiOperation({ summary: 'Update an alert rule' })
  @ApiOkResponse({ description: 'Rule updated' })
  @ApiNotFoundResponse({
    type: ErrorResponseDto,
    description: 'Rule not found',
  })
  updateRule(
    @CurrentUser() authUser: AuthUser,
    @Param('id') ruleId: string,
    @Body() dto: UpdateAlertRuleDto,
  ) {
    return this.alertsService.updateRule(authUser, ruleId, dto);
  }

  @Delete('rules/:id')
  @Roles(UserRole.SUPERADMIN, UserRole.CARRIER)
  @ApiOperation({ summary: 'Delete an alert rule' })
  @ApiOkResponse({ description: 'Rule deleted' })
  @ApiNotFoundResponse({
    type: ErrorResponseDto,
    description: 'Rule not found',
  })
  deleteRule(@CurrentUser() authUser: AuthUser, @Param('id') ruleId: string) {
    return this.alertsService.deleteRule(authUser, ruleId);
  }

  @Get()
  @ApiOperation({ summary: 'List sensor alerts' })
  @ApiOkResponse({ description: 'List of alerts' })
  listAlerts(
    @CurrentUser() authUser: AuthUser,
    @Query() query: ListAlertsQueryDto,
  ) {
    return this.alertsService.listAlerts(authUser, query);
  }

  @Patch(':id/acknowledge')
  @ApiOperation({ summary: 'Acknowledge an alert' })
  @ApiOkResponse({ description: 'Alert acknowledged' })
  @ApiNotFoundResponse({
    type: ErrorResponseDto,
    description: 'Alert not found',
  })
  acknowledgeAlert(
    @CurrentUser() authUser: AuthUser,
    @Param('id') alertId: string,
  ) {
    return this.alertsService.acknowledgeAlert(authUser, alertId);
  }

  @Patch(':id/resolve')
  @ApiOperation({ summary: 'Resolve an alert' })
  @ApiOkResponse({ description: 'Alert resolved' })
  @ApiNotFoundResponse({
    type: ErrorResponseDto,
    description: 'Alert not found',
  })
  resolveAlert(
    @CurrentUser() authUser: AuthUser,
    @Param('id') alertId: string,
  ) {
    return this.alertsService.resolveAlert(authUser, alertId);
  }

  @Get('webhook')
  @ApiOperation({ summary: 'Get webhook configuration' })
  @ApiOkResponse({ description: 'Webhook configuration' })
  getWebhook(@CurrentUser() authUser: AuthUser) {
    return this.alertsService.getWebhook(authUser);
  }

  @Post('webhook')
  @Roles(UserRole.SUPERADMIN, UserRole.CARRIER)
  @ApiOperation({ summary: 'Set webhook URL and secret for alert delivery' })
  @ApiOkResponse({ description: 'Webhook configured' })
  setWebhook(
    @CurrentUser() authUser: AuthUser,
    @Body() dto: { url?: string; secret?: string },
  ) {
    return this.alertsService.setWebhook(authUser, dto);
  }
}
