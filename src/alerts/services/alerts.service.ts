import {
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { createHmac } from 'crypto';
import {
  AlertStatus,
  CarrierProfile,
  Device,
  Metric,
  Prisma,
  RuleOperator,
  Severity,
  TelemetryRecord,
  UserRole,
} from '@prisma/client';
import type { AuthUser } from '../../common/types/auth-user.type';
import { CarrierProfileRepository } from '../../carrier/repositories/carrier-profile.repository';
import { PrismaService } from '../../prisma/prisma.service';
import { RealtimeService } from '../../realtime/realtime.service';
import { CreateAlertRuleDto } from '../dto/create-alert-rule.dto';
import { ListAlertsQueryDto } from '../dto/list-alerts-query.dto';
import { UpdateAlertRuleDto } from '../dto/update-alert-rule.dto';
import { AlertsRepository } from '../repositories/alerts.repository';

const METRIC_LABELS: Record<Metric, string> = {
  [Metric.TEMPERATURE]: 'Temperature',
  [Metric.HUMIDITY]: 'Humidity',
  [Metric.BATTERY]: 'Battery',
  [Metric.SPEED]: 'Speed',
};

@Injectable()
export class AlertsService {
  private readonly logger = new Logger(AlertsService.name);

  constructor(
    private readonly alertsRepository: AlertsRepository,
    private readonly carrierProfileRepository: CarrierProfileRepository,
    private readonly realtimeService: RealtimeService,
    private readonly prisma: PrismaService,
  ) {}

  async createRule(authUser: AuthUser, dto: CreateAlertRuleDto) {
    await this.assertCanManageRule(authUser, dto.deviceId ?? null);

    const rule = await this.alertsRepository.createRule({
      deviceId: dto.deviceId ?? null,
      metric: dto.metric,
      operator: dto.operator,
      threshold: dto.threshold,
      severity: dto.severity ?? Severity.WARNING,
      isActive: dto.isActive ?? true,
    });

    return { rule };
  }

  async updateRule(
    authUser: AuthUser,
    ruleId: string,
    dto: UpdateAlertRuleDto,
  ) {
    const rule = await this.findRuleOrThrow(ruleId);
    await this.assertCanManageRule(authUser, rule.deviceId);

    const updated = await this.alertsRepository.updateRule(ruleId, dto);
    return { rule: updated };
  }

  async deleteRule(authUser: AuthUser, ruleId: string) {
    const rule = await this.findRuleOrThrow(ruleId);
    await this.assertCanManageRule(authUser, rule.deviceId);

    const deleted = await this.alertsRepository.deleteRule(ruleId);
    return { rule: deleted };
  }

  async listRules(authUser: AuthUser) {
    if (authUser.role === UserRole.SUPERADMIN) {
      return { rules: await this.alertsRepository.findRules({}) };
    }

    const carrierProfile = await this.carrierProfileRepository.findByUserId(
      authUser.id,
    );
    if (!carrierProfile) {
      return { rules: [] };
    }

    const deviceIds = await this.getCarrierDeviceIds(carrierProfile.id);
    const rules = await this.alertsRepository.findRules({});
    return {
      rules: rules.filter(
        (rule) => !rule.deviceId || deviceIds.includes(rule.deviceId),
      ),
    };
  }

  async listAlerts(authUser: AuthUser, query: ListAlertsQueryDto) {
    const where = await this.buildAlertsWhere(authUser, query);
    const [alerts, total] = await Promise.all([
      this.alertsRepository.findAlerts({
        where,
        skip: query.skip ?? 0,
        take: query.take ?? 20,
      }),
      this.alertsRepository.countAlerts(where),
    ]);

    return { alerts, total };
  }

  async acknowledgeAlert(authUser: AuthUser, alertId: string) {
    const alert = await this.findAlertOrThrow(alertId);
    await this.assertCanMutateAlert(authUser, alert.deviceId);

    if (alert.status === AlertStatus.OPEN) {
      const updated = await this.alertsRepository.updateAlert(alert.id, {
        status: AlertStatus.ACKNOWLEDGED,
        acknowledgedAt: new Date(),
        acknowledgedBy: authUser.id,
      });
      return { alert: updated };
    }

    return { alert };
  }

  async resolveAlert(authUser: AuthUser, alertId: string) {
    const alert = await this.findAlertOrThrow(alertId);
    await this.assertCanMutateAlert(authUser, alert.deviceId);

    if (alert.status !== AlertStatus.RESOLVED) {
      const updated = await this.alertsRepository.updateAlert(alert.id, {
        status: AlertStatus.RESOLVED,
      });
      return { alert: updated };
    }

    return { alert };
  }

  async setWebhook(authUser: AuthUser, dto: { url?: string; secret?: string }) {
    this.assertCarrierRole(authUser);
    const carrierProfile = await this.getCarrierProfileOrThrow(authUser);

    const updated = await this.carrierProfileRepository.updateByUserId(
      carrierProfile.userId,
      {
        webhookUrl: dto.url ?? null,
        webhookSecret: dto.secret ?? null,
      },
    );

    return {
      webhookUrl: updated.webhookUrl,
      webhookConfigured: Boolean(updated.webhookUrl),
    };
  }

  async getWebhook(authUser: AuthUser) {
    this.assertCarrierRole(authUser);
    const carrierProfile = await this.getCarrierProfileOrThrow(authUser);
    return {
      webhookUrl: carrierProfile.webhookUrl,
      webhookConfigured: Boolean(carrierProfile.webhookUrl),
    };
  }

  async evaluateTelemetry(device: Device, record: TelemetryRecord) {
    if (device.status !== 'ACTIVE') {
      return;
    }

    const rules = await this.alertsRepository.findActiveRulesForDevice(
      device.id,
    );
    for (const rule of rules) {
      const value = this.extractMetricValue(record, rule.metric);
      if (value === null || value === undefined) {
        continue;
      }

      const triggered = this.isTriggered(value, rule.operator, rule.threshold);

      if (!triggered) {
        await this.alertsRepository.resolveAlertsForRule(device.id, rule.id);
        continue;
      }

      const openAlert = await this.alertsRepository.findOpenAlertForRule(
        device.id,
        rule.id,
      );
      if (openAlert) {
        continue;
      }

      const severity = rule.severity;
      const message = `${METRIC_LABELS[rule.metric]} ${value} ${this.operatorSymbol(rule.operator)} ${rule.threshold}`;

      const alert = await this.alertsRepository.createAlert({
        deviceId: device.id,
        vehicleId: record.vehicleId,
        orderId: record.orderId,
        ruleId: rule.id,
        metric: rule.metric,
        value,
        severity,
        message,
        status: AlertStatus.OPEN,
      });

      this.realtimeService.emitAlert({
        id: alert.id,
        deviceId: alert.deviceId,
        vehicleId: alert.vehicleId,
        orderId: alert.orderId,
        metric: alert.metric,
        value: alert.value,
        severity: alert.severity,
        message: alert.message,
        createdAt: alert.createdAt.toISOString(),
      });

      void this.sendWebhook(alert);
    }
  }

  private async sendWebhook(alert: {
    id: string;
    deviceId: string;
    vehicleId: string | null;
    orderId: string | null;
    metric: Metric;
    value: number;
    severity: Severity;
    message: string;
    status: AlertStatus;
    createdAt: Date;
  }) {
    try {
      if (!alert.vehicleId) {
        return;
      }

      const vehicle = await this.prisma.vehicle.findUnique({
        where: { id: alert.vehicleId },
        select: { carrierId: true },
      });
      if (!vehicle) {
        return;
      }

      const profile = await this.prisma.carrierProfile.findUnique({
        where: { id: vehicle.carrierId },
        select: { webhookUrl: true, webhookSecret: true },
      });
      if (!profile?.webhookUrl) {
        return;
      }

      const body = JSON.stringify({
        id: alert.id,
        deviceId: alert.deviceId,
        vehicleId: alert.vehicleId,
        orderId: alert.orderId,
        metric: alert.metric,
        value: alert.value,
        severity: alert.severity,
        message: alert.message,
        status: alert.status,
        createdAt: alert.createdAt,
      });

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'User-Agent': 'CaspX-Alerts',
      };
      if (profile.webhookSecret) {
        headers['X-Caspex-Signature'] = createHmac(
          'sha256',
          profile.webhookSecret,
        )
          .update(body)
          .digest('hex');
      }

      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 5000);
      try {
        await fetch(profile.webhookUrl, {
          method: 'POST',
          headers,
          body,
          signal: controller.signal,
        });
      } finally {
        clearTimeout(timer);
      }
    } catch (error) {
      this.logger.warn(
        `Webhook delivery failed for alert ${alert.id}: ${
          error instanceof Error ? error.message : 'unknown error'
        }`,
      );
    }
  }

  private extractMetricValue(
    record: TelemetryRecord,
    metric: Metric,
  ): number | null | undefined {
    switch (metric) {
      case Metric.TEMPERATURE:
        return record.temperature;
      case Metric.HUMIDITY:
        return record.humidity;
      case Metric.BATTERY:
        return record.battery;
      case Metric.SPEED:
        return record.speedKmh;
    }
  }

  private isTriggered(
    value: number,
    operator: RuleOperator,
    threshold: number,
  ): boolean {
    switch (operator) {
      case RuleOperator.GT:
        return value > threshold;
      case RuleOperator.GTE:
        return value >= threshold;
      case RuleOperator.LT:
        return value < threshold;
      case RuleOperator.LTE:
        return value <= threshold;
    }
  }

  private operatorSymbol(operator: RuleOperator): string {
    switch (operator) {
      case RuleOperator.GT:
        return '>';
      case RuleOperator.GTE:
        return '>=';
      case RuleOperator.LT:
        return '<';
      case RuleOperator.LTE:
        return '<=';
    }
  }

  private async assertCanManageRule(
    authUser: AuthUser,
    deviceId: string | null,
  ) {
    if (authUser.role === UserRole.SUPERADMIN) {
      return;
    }
    if (authUser.role !== UserRole.CARRIER) {
      throw new ForbiddenException(
        'Only SUPERADMIN or CARRIER can manage alert rules',
      );
    }
    if (!deviceId) {
      throw new ForbiddenException('Only SUPERADMIN can manage global rules');
    }

    const carrierProfile = await this.getCarrierProfileOrThrow(authUser);
    const device = await this.prisma.device.findUnique({
      where: { id: deviceId },
      select: { vehicleId: true },
    });
    if (!device) {
      throw new NotFoundException('Device not found');
    }
    if (
      device.vehicleId &&
      !(await this.isCarrierVehicle(carrierProfile, device.vehicleId))
    ) {
      throw new NotFoundException('Device not found');
    }
  }

  private async buildAlertsWhere(
    authUser: AuthUser,
    query: ListAlertsQueryDto,
  ): Promise<Prisma.SensorAlertWhereInput> {
    const base: Prisma.SensorAlertWhereInput = {
      deviceId: query.deviceId,
      vehicleId: query.vehicleId,
      orderId: query.orderId,
      status: query.status,
      createdAt: {
        gte: query.from ? new Date(query.from) : undefined,
        lte: query.to ? new Date(query.to) : undefined,
      },
    };

    if (authUser.role === UserRole.SUPERADMIN) {
      return base;
    }

    const carrierProfile = await this.carrierProfileRepository.findByUserId(
      authUser.id,
    );

    if (authUser.role === UserRole.CARRIER) {
      if (!carrierProfile) {
        return { id: '__none__' };
      }
      return {
        ...base,
        vehicle: { carrierId: carrierProfile.id },
      };
    }

    return {
      ...base,
      order: { clientId: authUser.id },
    };
  }

  private async assertCanMutateAlert(authUser: AuthUser, deviceId: string) {
    if (authUser.role === UserRole.SUPERADMIN) {
      return;
    }
    if (authUser.role !== UserRole.CARRIER) {
      throw new ForbiddenException(
        'Only SUPERADMIN or CARRIER can mutate alerts',
      );
    }

    const carrierProfile = await this.getCarrierProfileOrThrow(authUser);
    const device = await this.prisma.device.findUnique({
      where: { id: deviceId },
      select: { vehicleId: true },
    });
    if (
      !device?.vehicleId ||
      !(await this.isCarrierVehicle(carrierProfile, device.vehicleId))
    ) {
      throw new NotFoundException('Alert not found');
    }
  }

  private async getCarrierDeviceIds(carrierId: string): Promise<string[]> {
    const devices = await this.prisma.device.findMany({
      where: { vehicle: { carrierId } },
      select: { id: true },
    });
    return devices.map((device) => device.id);
  }

  private async findRuleOrThrow(ruleId: string) {
    const rule = await this.alertsRepository.findRuleById(ruleId);
    if (!rule) {
      throw new NotFoundException('Alert rule not found');
    }
    return rule;
  }

  private async findAlertOrThrow(alertId: string) {
    const alert = await this.alertsRepository.findAlertById(alertId);
    if (!alert) {
      throw new NotFoundException('Alert not found');
    }
    return alert;
  }

  private assertCarrierRole(authUser: AuthUser) {
    if (
      authUser.role !== UserRole.SUPERADMIN &&
      authUser.role !== UserRole.CARRIER
    ) {
      throw new ForbiddenException(
        'Only SUPERADMIN or CARRIER can configure webhooks',
      );
    }
  }

  private async getCarrierProfileOrThrow(
    authUser: AuthUser,
  ): Promise<CarrierProfile> {
    const profile = await this.carrierProfileRepository.findByUserId(
      authUser.id,
    );
    if (!profile) {
      throw new NotFoundException('Carrier profile not found');
    }
    return profile;
  }

  private async isCarrierVehicle(
    carrierProfile: CarrierProfile,
    vehicleId: string,
  ): Promise<boolean> {
    const vehicle = await this.prisma.vehicle.findFirst({
      where: { id: vehicleId, carrierId: carrierProfile.id },
      select: { id: true },
    });
    return Boolean(vehicle);
  }
}
