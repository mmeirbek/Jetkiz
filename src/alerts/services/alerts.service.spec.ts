import { NotFoundException } from '@nestjs/common';
import {
  AlertStatus,
  Metric,
  RuleOperator,
  Severity,
  UserRole,
} from '@prisma/client';
import { RealtimeService } from '../../realtime/realtime.service';
import { AlertsService } from './alerts.service';

describe('AlertsService', () => {
  const alertsRepositoryMock = {
    createRule: jest.fn(),
    updateRule: jest.fn(),
    deleteRule: jest.fn(),
    findRuleById: jest.fn(),
    findActiveRulesForDevice: jest.fn(),
    findRules: jest.fn(),
    findOpenAlertForRule: jest.fn(),
    createAlert: jest.fn(),
    resolveAlertsForRule: jest.fn(),
    findAlerts: jest.fn(),
    countAlerts: jest.fn(),
    findAlertById: jest.fn(),
    updateAlert: jest.fn(),
  };

  const carrierProfileRepositoryMock = {
    findByUserId: jest.fn(),
    updateByUserId: jest.fn(),
  };

  const realtimeServiceMock = {
    emitAlert: jest.fn(),
  };

  const prismaMock = {
    vehicle: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
    },
    carrierProfile: {
      findUnique: jest.fn(),
    },
    device: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
    },
  };

  const superAdmin = {
    id: 'user-sa',
    email: 'sa@caspex.local',
    role: UserRole.SUPERADMIN,
    firstName: 'S',
    lastName: 'A',
    phone: '+77000000000',
    isActive: true,
  };

  const carrier = {
    id: 'user-c',
    email: 'c@caspex.local',
    role: UserRole.CARRIER,
    firstName: 'C',
    lastName: 'R',
    phone: '+77000000001',
    isActive: true,
  };

  const carrierProfile = {
    id: 'profile-1',
    userId: carrier.id,
    experienceYears: 5,
    transportType: 'truck',
    isApproved: true,
    rating: null,
    completedOrders: 0,
    webhookUrl: 'https://webhook.example.com/alerts',
    webhookSecret: 'secret-key',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const device = {
    id: 'device-1',
    name: 'GPS tracker',
    secretHash: 'hash',
    status: 'ACTIVE',
    vehicleId: 'vehicle-1',
    lastLat: 45.3,
    lastLng: 51.1,
    lastSeenAt: new Date(),
    createdAt: new Date(),
  };

  const telemetryRecord = {
    id: 'tel-1',
    deviceId: 'device-1',
    vehicleId: 'vehicle-1',
    orderId: 'order-1',
    temperature: 30,
    humidity: 60,
    battery: 90,
    speedKmh: 70,
    lat: 45.3,
    lng: 51.1,
    eventTime: new Date('2026-08-19T12:00:00.000Z'),
    raw: {},
    createdAt: new Date('2026-08-19T12:00:00.000Z'),
  };

  let service: AlertsService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new AlertsService(
      alertsRepositoryMock as never,
      carrierProfileRepositoryMock as never,
      realtimeServiceMock as never,
      prismaMock as never,
    );
  });

  it('creates a rule as superadmin', async () => {
    alertsRepositoryMock.createRule.mockResolvedValue({ id: 'rule-1' });

    const result = await service.createRule(superAdmin, {
      deviceId: 'device-1',
      metric: Metric.TEMPERATURE,
      operator: RuleOperator.GT,
      threshold: 24,
      severity: Severity.WARNING,
    });

    expect(alertsRepositoryMock.createRule).toHaveBeenCalledWith({
      deviceId: 'device-1',
      metric: Metric.TEMPERATURE,
      operator: RuleOperator.GT,
      threshold: 24,
      severity: Severity.WARNING,
      isActive: true,
    });
    expect(result).toEqual({ rule: { id: 'rule-1' } });
  });

  it('forbids a carrier from creating a global rule', async () => {
    await expect(
      service.createRule(carrier, {
        metric: Metric.TEMPERATURE,
        operator: RuleOperator.GT,
        threshold: 24,
      }),
    ).rejects.toThrow('Only SUPERADMIN can manage global rules');
    expect(alertsRepositoryMock.createRule).not.toHaveBeenCalled();
  });

  it('creates a rule for an owned device as carrier', async () => {
    prismaMock.device.findUnique.mockResolvedValue({
      id: 'device-1',
      vehicleId: 'vehicle-1',
    });
    prismaMock.vehicle.findFirst.mockResolvedValue({
      id: 'vehicle-1',
      carrierId: carrierProfile.id,
    });
    carrierProfileRepositoryMock.findByUserId.mockResolvedValue(carrierProfile);
    alertsRepositoryMock.createRule.mockResolvedValue({ id: 'rule-1' });

    const result = await service.createRule(carrier, {
      deviceId: 'device-1',
      metric: Metric.BATTERY,
      operator: RuleOperator.LT,
      threshold: 20,
    });

    expect(result).toEqual({ rule: { id: 'rule-1' } });
  });

  it('creates a deduplicated alert when a rule triggers', async () => {
    alertsRepositoryMock.findActiveRulesForDevice.mockResolvedValue([
      {
        id: 'rule-1',
        deviceId: 'device-1',
        metric: Metric.TEMPERATURE,
        operator: RuleOperator.GT,
        threshold: 24,
        severity: Severity.CRITICAL,
        isActive: true,
      },
    ]);
    alertsRepositoryMock.findOpenAlertForRule.mockResolvedValue(null);
    alertsRepositoryMock.createAlert.mockResolvedValue({
      id: 'alert-1',
      deviceId: 'device-1',
      vehicleId: 'vehicle-1',
      orderId: 'order-1',
      ruleId: 'rule-1',
      metric: Metric.TEMPERATURE,
      value: 30,
      severity: Severity.CRITICAL,
      message: 'Temperature 30 > 24',
      status: AlertStatus.OPEN,
      createdAt: new Date('2026-08-19T12:00:00.000Z'),
    });
    prismaMock.vehicle.findUnique.mockResolvedValue({
      id: 'vehicle-1',
      carrierId: carrierProfile.id,
    });
    prismaMock.carrierProfile.findUnique.mockResolvedValue({
      webhookUrl: carrierProfile.webhookUrl,
      webhookSecret: carrierProfile.webhookSecret,
    });
    global.fetch = jest.fn().mockResolvedValue({ ok: true }) as never;

    await service.evaluateTelemetry(device as never, telemetryRecord);

    expect(alertsRepositoryMock.createAlert).toHaveBeenCalledWith(
      expect.objectContaining({
        deviceId: 'device-1',
        vehicleId: 'vehicle-1',
        orderId: 'order-1',
        ruleId: 'rule-1',
        metric: Metric.TEMPERATURE,
        value: 30,
        severity: Severity.CRITICAL,
        status: AlertStatus.OPEN,
      }),
    );
    expect(realtimeServiceMock.emitAlert).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'alert-1' }),
    );
  });

  it('does not create a duplicate alert while one is open', async () => {
    alertsRepositoryMock.findActiveRulesForDevice.mockResolvedValue([
      {
        id: 'rule-1',
        deviceId: 'device-1',
        metric: Metric.TEMPERATURE,
        operator: RuleOperator.GT,
        threshold: 24,
        severity: Severity.WARNING,
        isActive: true,
      },
    ]);
    alertsRepositoryMock.findOpenAlertForRule.mockResolvedValue({
      id: 'alert-open',
    });

    await service.evaluateTelemetry(device as never, telemetryRecord);

    expect(alertsRepositoryMock.createAlert).not.toHaveBeenCalled();
  });

  it('auto-resolves an open alert when the condition clears', async () => {
    alertsRepositoryMock.findActiveRulesForDevice.mockResolvedValue([
      {
        id: 'rule-1',
        deviceId: 'device-1',
        metric: Metric.TEMPERATURE,
        operator: RuleOperator.GT,
        threshold: 24,
        severity: Severity.WARNING,
        isActive: true,
      },
    ]);

    const coolRecord = { ...telemetryRecord, temperature: 20 };
    await service.evaluateTelemetry(device as never, coolRecord);

    expect(alertsRepositoryMock.resolveAlertsForRule).toHaveBeenCalledWith(
      'device-1',
      'rule-1',
    );
    expect(alertsRepositoryMock.createAlert).not.toHaveBeenCalled();
  });

  it('lists only own alerts for a carrier', async () => {
    carrierProfileRepositoryMock.findByUserId.mockResolvedValue(carrierProfile);
    alertsRepositoryMock.findAlerts.mockResolvedValue([{ id: 'alert-1' }]);
    alertsRepositoryMock.countAlerts.mockResolvedValue(1);

    const result = await service.listAlerts(carrier, {});

    expect(alertsRepositoryMock.findAlerts).toHaveBeenCalledWith({
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment -- jest.objectContaining returns `any`
      where: expect.objectContaining({
        vehicle: { carrierId: carrierProfile.id },
      }),
      skip: 0,
      take: 20,
    });
    expect(result).toEqual({ alerts: [{ id: 'alert-1' }], total: 1 });
  });

  it('acknowledges an open alert as superadmin', async () => {
    alertsRepositoryMock.findAlertById.mockResolvedValue({
      id: 'alert-1',
      deviceId: 'device-1',
      status: AlertStatus.OPEN,
    });
    alertsRepositoryMock.updateAlert.mockResolvedValue({
      id: 'alert-1',
      status: AlertStatus.ACKNOWLEDGED,
      acknowledgedAt: new Date(),
      acknowledgedBy: superAdmin.id,
    });

    const result = await service.acknowledgeAlert(superAdmin, 'alert-1');

    expect(alertsRepositoryMock.updateAlert).toHaveBeenCalledWith(
      'alert-1',
      expect.objectContaining({
        status: AlertStatus.ACKNOWLEDGED,
        acknowledgedBy: superAdmin.id,
      }),
    );
    expect(result.alert.status).toBe(AlertStatus.ACKNOWLEDGED);
  });

  it('throws NotFound when alert is missing', async () => {
    alertsRepositoryMock.findAlertById.mockResolvedValue(null);

    await expect(
      service.acknowledgeAlert(superAdmin, 'missing'),
    ).rejects.toThrow(NotFoundException);
  });

  it('sets the webhook configuration for a carrier', async () => {
    carrierProfileRepositoryMock.findByUserId.mockResolvedValue(carrierProfile);
    carrierProfileRepositoryMock.updateByUserId.mockResolvedValue({
      ...carrierProfile,
      webhookUrl: 'https://new.example.com/hook',
      webhookSecret: 'new-secret',
    });

    const result = await service.setWebhook(carrier, {
      url: 'https://new.example.com/hook',
      secret: 'new-secret',
    });

    expect(carrierProfileRepositoryMock.updateByUserId).toHaveBeenCalledWith(
      carrier.id,
      {
        webhookUrl: 'https://new.example.com/hook',
        webhookSecret: 'new-secret',
      },
    );
    expect(result).toEqual({
      webhookUrl: 'https://new.example.com/hook',
      webhookConfigured: true,
    });
  });

  it('forbids a client from managing rules', async () => {
    const client = { ...carrier, role: UserRole.CLIENT };

    await expect(
      service.createRule(client, {
        metric: Metric.TEMPERATURE,
        operator: RuleOperator.GT,
        threshold: 24,
      }),
    ).rejects.toThrow('Only SUPERADMIN or CARRIER can manage alert rules');
  });

  it('exposes noop realtime service methods', () => {
    expect(RealtimeService).toBeDefined();
  });
});
