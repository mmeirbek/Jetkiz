import { Injectable } from '@nestjs/common';
import { AlertStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class AlertsRepository {
  constructor(private readonly prisma: PrismaService) {}

  createRule(data: Prisma.SensorRuleUncheckedCreateInput) {
    return this.prisma.sensorRule.create({ data });
  }

  updateRule(ruleId: string, data: Prisma.SensorRuleUncheckedUpdateInput) {
    return this.prisma.sensorRule.update({ where: { id: ruleId }, data });
  }

  deleteRule(ruleId: string) {
    return this.prisma.sensorRule.delete({ where: { id: ruleId } });
  }

  findRuleById(ruleId: string) {
    return this.prisma.sensorRule.findUnique({ where: { id: ruleId } });
  }

  findActiveRulesForDevice(deviceId: string) {
    return this.prisma.sensorRule.findMany({
      where: {
        isActive: true,
        OR: [{ deviceId }, { deviceId: null }],
      },
    });
  }

  findRules(params: { deviceId?: string; isActive?: boolean }) {
    return this.prisma.sensorRule.findMany({
      where: {
        deviceId: params.deviceId,
        isActive: params.isActive,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  findOpenAlertForRule(deviceId: string, ruleId: string) {
    return this.prisma.sensorAlert.findFirst({
      where: {
        deviceId,
        ruleId,
        status: { in: [AlertStatus.OPEN, AlertStatus.ACKNOWLEDGED] },
      },
      select: { id: true },
    });
  }

  createAlert(data: Prisma.SensorAlertUncheckedCreateInput) {
    return this.prisma.sensorAlert.create({ data });
  }

  resolveAlertsForRule(deviceId: string, ruleId: string) {
    return this.prisma.sensorAlert.updateMany({
      where: {
        deviceId,
        ruleId,
        status: { in: [AlertStatus.OPEN, AlertStatus.ACKNOWLEDGED] },
      },
      data: { status: AlertStatus.RESOLVED },
    });
  }

  findAlerts(params: {
    where: Prisma.SensorAlertWhereInput;
    skip?: number;
    take?: number;
  }) {
    return this.prisma.sensorAlert.findMany({
      where: params.where,
      orderBy: { createdAt: 'desc' },
      skip: params.skip,
      take: params.take,
    });
  }

  countAlerts(where: Prisma.SensorAlertWhereInput) {
    return this.prisma.sensorAlert.count({ where });
  }

  findAlertById(alertId: string) {
    return this.prisma.sensorAlert.findUnique({ where: { id: alertId } });
  }

  updateAlert(alertId: string, data: Prisma.SensorAlertUncheckedUpdateInput) {
    return this.prisma.sensorAlert.update({ where: { id: alertId }, data });
  }
}
