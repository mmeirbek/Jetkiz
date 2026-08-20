import {
  BadGatewayException,
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { RoutesService } from '../../routes/services/routes.service';
import type { AuthUser } from '../../common/types/auth-user.type';
import { AggregatorService, type AggregatedInput } from './aggregator.service';
import { OpenAiService, type PredictionResult } from './open-ai.service';
import { OpenWeatherService } from './open-weather.service';
import { RoutePointResolverService } from './route-point-resolver.service';

const PREDICTION_TTL_MS = 6 * 60 * 60 * 1000;

@Injectable()
export class PredictionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly routesService: RoutesService,
    private readonly openWeatherService: OpenWeatherService,
    private readonly routePointResolver: RoutePointResolverService,
    private readonly aggregatorService: AggregatorService,
    private readonly openAiService: OpenAiService,
  ) {}

  async listForUser(authUser: AuthUser) {
    const orders = await this.prisma.order.findMany({
      where: {
        ...(authUser.role === UserRole.ADMIN || authUser.role === UserRole.SUPERADMIN
          ? {}
          : { clientId: authUser.id }),
        originLat: { not: null },
        originLng: { not: null },
        destinationLat: { not: null },
        destinationLng: { not: null },
      },
      orderBy: { createdAt: 'desc' },
    });

    const existing = await this.prisma.orderPrediction.findMany({
      where: { orderId: { in: orders.map((o) => o.id) } },
    });
    const byOrderId = new Map(existing.map((p) => [p.orderId, p]));

    const items: PredictionListItem[] = [];
    for (const order of orders) {
      const stored = byOrderId.get(order.id);
      if (
        stored &&
        Date.now() - new Date(stored.updatedAt).getTime() < PREDICTION_TTL_MS
      ) {
        items.push({
          orderId: order.id,
          title: order.title,
          origin: order.origin,
          destination: order.destination,
          recommendation: stored.recommendation,
          riskLevel: stored.riskLevel,
          bestDepartureTime: stored.bestDepartureTime.toISOString(),
          expectedDelayMinutes: stored.expectedDelayMinutes,
          shortExplanation: stored.shortExplanation,
          data: stored.inputSnapshot as unknown as AggregatedInput,
          source: stored.source,
          generatedAt: stored.updatedAt.toISOString(),
        });
        continue;
      }

      const item = await this.computeAndPersist(order.id, 'rule');
      items.push(item);
    }

    return { predictions: items };
  }

  async predictLand(orderId: string) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
    });
    if (!order) {
      throw new NotFoundException('Order not found');
    }

    this.ensureCoordinates(order);

    const stored = await this.prisma.orderPrediction.findUnique({
      where: { orderId },
    });
    if (
      stored &&
      Date.now() - new Date(stored.updatedAt).getTime() < PREDICTION_TTL_MS
    ) {
      return this.toListItem(order, stored);
    }

    const hasAiKey = !!process.env.OPENAI_API_KEY;
    if (!hasAiKey) {
      return this.computeAndPersist(order.id, 'rule');
    }

    try {
      return await this.computeAndPersist(order.id, 'ai');
    } catch (error) {
      if (error instanceof BadGatewayException) {
        return this.computeAndPersist(order.id, 'rule');
      }
      throw error;
    }
  }

  private async computeAndPersist(
    orderId: string,
    source: 'ai' | 'rule',
  ): Promise<PredictionListItem> {
    const order = await this.prisma.order.findUnique({ where: { id: orderId } });
    if (!order) {
      throw new NotFoundException('Order not found');
    }
    this.ensureCoordinates(order);

    const aggregated = await this.collectData({
      originLat: order.originLat as number,
      originLng: order.originLng as number,
      destinationLat: order.destinationLat as number,
      destinationLng: order.destinationLng as number,
    });

    let result: PredictionResult;
    if (source === 'ai') {
      result = await this.openAiService.predict(aggregated);
    } else {
      result = this.ruleBasedPrediction(aggregated);
    }

    const safe = this.sanitize(result);
    const persisted = await this.prisma.orderPrediction.upsert({
      where: { orderId },
      create: {
        orderId,
        recommendation: safe.recommendation,
        riskLevel: safe.riskLevel,
        bestDepartureTime: new Date(safe.bestDepartureTime),
        expectedDelayMinutes: safe.expectedDelayMinutes,
        shortExplanation: safe.shortExplanation,
        inputSnapshot: aggregated as unknown as object,
        source,
      },
      update: {
        recommendation: safe.recommendation,
        riskLevel: safe.riskLevel,
        bestDepartureTime: new Date(safe.bestDepartureTime),
        expectedDelayMinutes: safe.expectedDelayMinutes,
        shortExplanation: safe.shortExplanation,
        inputSnapshot: aggregated as unknown as object,
        source,
      },
    });

    return this.toListItem(order, persisted);
  }

  private async collectData(order: {
    originLat: number;
    originLng: number;
    destinationLat: number;
    destinationLng: number;
  }): Promise<AggregatedInput> {
    const route = await this.calculateRouteOrFallback(order);

    const waypoints = this.routePointResolver.getWeatherWaypoints(
      route.geometry.coordinates,
      5,
    );

    const [weatherPoints, nearbyCheckpoints, nearbyRailway] = await Promise.all([
      this.openWeatherService.getWeatherForPoints(waypoints),
      this.routePointResolver.findNearbyCheckpoints(
        route.geometry.coordinates,
        50,
      ),
      this.routePointResolver.findNearbyRailwayNodes(
        route.geometry.coordinates,
        50,
      ),
    ]);

    return this.aggregatorService.aggregate(
      { distanceKm: route.distanceKm, durationMinutes: route.durationMinutes },
      weatherPoints,
      nearbyCheckpoints,
      nearbyRailway,
    );
  }

  private async calculateRouteOrFallback(order: {
    originLat: number;
    originLng: number;
    destinationLat: number;
    destinationLng: number;
  }): Promise<{
    distanceKm: number;
    durationMinutes: number;
    geometry: { type: string; coordinates: number[][] };
  }> {
    try {
      return await this.routesService.calculate(
        {
          id: '',
          role: 'SUPERADMIN',
          email: '',
          firstName: '',
          lastName: '',
          phone: '',
          isActive: true,
        },
        {
          startLat: order.originLat,
          startLng: order.originLng,
          endLat: order.destinationLat,
          endLng: order.destinationLng,
        },
      );
    } catch {
      const distanceKm = Number(
        this.haversineKm(
          order.originLat,
          order.originLng,
          order.destinationLat,
          order.destinationLng,
        ).toFixed(1),
      );
      const durationMinutes = Math.max(1, Math.round((distanceKm / 55) * 60));
      return {
        distanceKm,
        durationMinutes,
        geometry: {
          type: 'LineString',
          coordinates: [
            [order.originLng, order.originLat],
            [order.destinationLng, order.destinationLat],
          ],
        },
      };
    }
  }

  private haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
    const R = 6371;
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLng = ((lng2 - lng1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLng / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

  private ruleBasedPrediction(aggregated: AggregatedInput): PredictionResult {
    const { route, weather, checkpoints, railway } = aggregated;

    const reasons: string[] = [];
    let score = 0;
    let riskLevel: 'low' | 'medium' | 'high' = 'low';

    if (weather.rain) {
      reasons.push(`по маршруту ожидаются осадки (ветер до ${weather.wind} м/с)`);
      score += 2;
    } else if (weather.wind > 20) {
      reasons.push(`сильный ветер до ${weather.wind} м/с`);
      score += 1;
    } else if (weather.wind > 10) {
      reasons.push(`ветер до ${weather.wind} м/с`);
    }

    const loadedCheckpoints = checkpoints.filter((c) => c.load > 60);
    if (loadedCheckpoints.length > 0) {
      reasons.push(
        `загруженность КПП: ${loadedCheckpoints
          .map((c) => `${c.name} (${c.load}%)`)
          .join(', ')}`,
      );
      score += Math.min(3, loadedCheckpoints.length);
    }

    const loadedRailway = railway.filter((r) => r.load > 50);
    if (loadedRailway.length > 0) {
      reasons.push(
        `высокая нагрузка на ж/д: ${loadedRailway
          .map((r) => `${r.station} (${r.load})`)
          .join(', ')}`,
      );
      score += Math.min(2, loadedRailway.length);
    }

    if (score > 4) riskLevel = 'high';
    else if (score > 1) riskLevel = 'medium';

    const recommendation: 'send' | 'wait' | 'alternative' =
      riskLevel === 'high' ? 'wait' : riskLevel === 'medium' ? 'send' : 'send';
    if (recommendation === 'wait') {
      reasons.push('рекомендуется отложить отправку до улучшения условий');
    } else if (reasons.length === 0) {
      reasons.push('погодные условия и загрузка пунктов контроля благоприятные');
    }

    const expectedDelayMinutes = Math.round(
      (weather.rain ? 45 : 0) +
        loadedCheckpoints.reduce((s, c) => s + Math.max(0, c.wait), 0) +
        loadedRailway.length * 20,
    );

    const hoursUntil = recommendation === 'wait' ? 12 : 2;
    const bestDepartureTime = new Date(
      Date.now() + hoursUntil * 60 * 60 * 1000,
    ).toISOString();

    return {
      recommendation,
      riskLevel,
      bestDepartureTime,
      expectedDelayMinutes,
      shortExplanation: `Маршрут ${route.distanceKm} км (~${route.durationHours} ч). ${reasons
        .map((r) => r.charAt(0).toUpperCase() + r.slice(1))
        .join('. ')}.`,
    };
  }

  private sanitize(result: PredictionResult): PredictionResult {
    const riskLevel =
      result.riskLevel === 'high' || result.riskLevel === 'medium'
        ? result.riskLevel
        : 'low';
    const recommendation =
      result.recommendation === 'send' ||
      result.recommendation === 'wait' ||
      result.recommendation === 'alternative'
        ? result.recommendation
        : 'send';
    const expectedDelayMinutes = Number.isFinite(result.expectedDelayMinutes)
      ? Math.max(0, Math.round(result.expectedDelayMinutes))
      : 0;

    let bestDepartureTime = result.bestDepartureTime;
    const parsed = new Date(bestDepartureTime);
    if (Number.isNaN(parsed.getTime())) {
      bestDepartureTime = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString();
    } else if (parsed.getTime() <= Date.now()) {
      bestDepartureTime = new Date(
        Date.now() + 60 * 60 * 1000,
      ).toISOString();
    }

    return {
      recommendation,
      riskLevel,
      bestDepartureTime,
      expectedDelayMinutes,
      shortExplanation:
        typeof result.shortExplanation === 'string' &&
        result.shortExplanation.trim().length > 0
          ? result.shortExplanation
          : 'Нет данных для объяснения.',
    };
  }

  private ensureCoordinates(order: {
    originLat: number | null;
    originLng: number | null;
    destinationLat: number | null;
    destinationLng: number | null;
  }) {
    if (
      order.originLat == null ||
      order.originLng == null ||
      order.destinationLat == null ||
      order.destinationLng == null
    ) {
      throw new BadRequestException(
        'Order has no coordinates. Set origin and destination coordinates first.',
      );
    }
  }

  private toListItem(
    order: { id: string; title: string; origin: string; destination: string },
    stored: {
      recommendation: string;
      riskLevel: string;
      bestDepartureTime: Date;
      expectedDelayMinutes: number;
      shortExplanation: string;
      inputSnapshot: unknown;
      source: string;
      updatedAt: Date;
    },
  ): PredictionListItem {
    return {
      orderId: order.id,
      title: order.title,
      origin: order.origin,
      destination: order.destination,
      recommendation: stored.recommendation,
      riskLevel: stored.riskLevel,
      bestDepartureTime: stored.bestDepartureTime.toISOString(),
      expectedDelayMinutes: stored.expectedDelayMinutes,
      shortExplanation: stored.shortExplanation,
      data: stored.inputSnapshot as AggregatedInput,
      source: stored.source,
      generatedAt: stored.updatedAt.toISOString(),
    };
  }

  //заглушка
  predictMarine(
    _originLat: number,
    _originLng: number,
    _destLat: number,
    _destLng: number,
  ) {
    return {
      recommendation: 'send',
      riskLevel: 'low',
      bestDepartureTime: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
      expectedDelayMinutes: 0,
      shortExplanation: 'Морской маршрут свободен.',
    };
  }
}

export type PredictionListItem = {
  orderId: string;
  title: string;
  origin: string;
  destination: string;
  recommendation: string;
  riskLevel: string;
  bestDepartureTime: string;
  expectedDelayMinutes: number;
  shortExplanation: string;
  data: AggregatedInput;
  source: string;
  generatedAt: string;
};