import { HttpService } from '@nestjs/axios';
import {
  BadGatewayException,
  BadRequestException,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { AxiosError } from 'axios';
import { Order, OrderStatus, UserRole } from '@prisma/client';
import { firstValueFrom } from 'rxjs';
import { CarrierProfileRepository } from '../../carrier/repositories/carrier-profile.repository';
import type { AuthUser } from '../../common/types/auth-user.type';
import { PrismaService } from '../../prisma/prisma.service';
import { CalculateRouteDto } from '../dto/calculate-route.dto';
import { RoutesRepository } from '../repositories/routes.repository';
import { VroomService, type VroomJob } from './vroom.service';

type ParsedRoute = {
  distanceKm: number;
  durationMinutes: number;
  geometry: { type: string; coordinates: number[][] };
};

type Coordinates = {
  startLat: number;
  startLng: number;
  endLat: number;
  endLng: number;
};

type OrsDirectionsResponse = {
  features?: Array<{
    geometry?: {
      type?: string;
      coordinates?: number[][];
    };
    properties?: {
      summary?: {
        distance?: number;
        duration?: number;
      };
    };
  }>;
};

type OrsErrorResponse = {
  error?:
    | string
    | {
        code?: number;
        message?: string;
      };
  message?: string;
};

type RouteStop = {
  orderId: string;
  action: 'pickup' | 'delivery';
  lat: number;
  lng: number;
};

type CarrierRoutePlan = {
  route: ParsedRoute | null;
  stops: RouteStop[];
  strategy: 'vroom' | 'greedy' | 'none';
};

@Injectable()
export class RoutesService {
  private readonly logger = new Logger(RoutesService.name);

  private static readonly FALLBACK_SPEED_KMH = 50;
  private static readonly ROUTE_CACHE_TTL_MS = 15 * 60 * 1000;

  private readonly routeCache = new Map<
    string,
    { parsed: ParsedRoute; expiresAt: number }
  >();

  constructor(
    private readonly httpService: HttpService,
    private readonly prisma: PrismaService,
    private readonly carrierProfileRepository: CarrierProfileRepository,
    private readonly routesRepository: RoutesRepository,
    private readonly vroomService: VroomService,
  ) {}

  async calculate(authUser: AuthUser, dto: CalculateRouteDto) {
    const order = dto.orderId
      ? await this.findVisibleOrderOrThrow(authUser, dto.orderId)
      : null;
    const coords = this.resolveCoordinates(dto, order);

    const parsed = await this.resolveParsedRoute(coords, false);

    const route = await this.routesRepository.create({
      orderId: order?.id ?? null,
      distanceKm: parsed.distanceKm,
      durationMinutes: parsed.durationMinutes,
      geometry: parsed.geometry,
    });

    return {
      routeId: route.id,
      orderId: route.orderId,
      distanceKm: route.distanceKm,
      durationMinutes: route.durationMinutes,
      geometry: parsed.geometry,
    };
  }

  async calculateForOrder(
    order: Pick<
      Order,
      'id' | 'originLat' | 'originLng' | 'destinationLat' | 'destinationLng'
    >,
  ) {
    const coords = this.resolveCoordinates({}, order);
    const parsed = await this.resolveParsedRoute(coords, true);

    return this.routesRepository.create({
      orderId: order.id,
      distanceKm: parsed.distanceKm,
      durationMinutes: parsed.durationMinutes,
      geometry: parsed.geometry,
    });
  }

  async calculateCarrierRoute(authUser: AuthUser) {
    if (
      authUser.role !== UserRole.CARRIER &&
      authUser.role !== UserRole.SUPERADMIN
    ) {
      throw new ForbiddenException('CARRIER role is required');
    }

    const carrierProfile = await this.carrierProfileRepository.findByUserId(
      authUser.id,
    );
    if (!carrierProfile) {
      throw new NotFoundException('Carrier profile not found');
    }

    const orders = await this.prisma.order.findMany({
      where: {
        carrierId: carrierProfile.id,
        status: {
          in: [
            OrderStatus.ASSIGNED,
            OrderStatus.PICKED_UP,
            OrderStatus.IN_TRANSIT,
            OrderStatus.AT_CHECKPOINT,
          ],
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    const routableOrders = orders.filter(
      (order) =>
        order.originLat != null &&
        order.originLng != null &&
        order.destinationLat != null &&
        order.destinationLng != null,
    );

    const vehicles = await this.prisma.vehicle.findMany({
      where: { carrierId: carrierProfile.id },
      orderBy: [{ lastSeenAt: 'desc' }, { createdAt: 'desc' }],
    });
    const vehicle = vehicles[0] ?? null;

    const usedKg = orders.reduce((sum, order) => sum + (order.weight ?? 0), 0);
    const capacityTons = vehicle?.capacityTons ?? 0;
    const freeTons = Number(
      Math.max(0, capacityTons - usedKg / 1000).toFixed(3),
    );

    const start = this.resolveCarrierStart(routableOrders, vehicle);

    let plan: CarrierRoutePlan;
    if (routableOrders.length === 0) {
      plan = { route: null, stops: [], strategy: 'none' };
    } else if (this.vroomService.isConfigured()) {
      try {
        plan = await this.optimizeCarrierRouteViaVroom(
          routableOrders,
          vehicle,
          start,
        );
      } catch (error) {
        this.logger.warn(
          `VROOM multi-stop routing failed: ${this.describeError(error)} — using greedy fallback`,
        );
        plan = this.optimizeCarrierRouteGreedy(routableOrders, start);
      }
    } else {
      plan = this.optimizeCarrierRouteGreedy(routableOrders, start);
    }

    return {
      orders: routableOrders.map((order) => ({
        id: order.id,
        title: order.title,
        origin: order.origin,
        destination: order.destination,
        weight: order.weight,
        volume: order.volume,
      })),
      vehicle: vehicle
        ? {
            id: vehicle.id,
            plateNumber: vehicle.plateNumber,
            capacityTons: vehicle.capacityTons,
          }
        : null,
      capacityTons,
      freeTons,
      savedFuelLiters: plan.route
        ? Number((plan.route.distanceKm * 0.28 * 0.33).toFixed(1))
        : 0,
      savedMoneyTenge: plan.route
        ? Math.round(plan.route.distanceKm * 0.28 * 0.33 * 450)
        : 0,
      savedEmptyKm: plan.route
        ? Math.round(plan.route.distanceKm * 0.28)
        : 0,
      savedHours: plan.route
        ? Number(((plan.route.distanceKm * 0.28) / 60).toFixed(1))
        : 0,
      route: plan.route,
      stops: plan.stops,
      sequence: plan.stops
        .filter((stop) => stop.action === 'pickup')
        .map((stop) => stop.orderId),
      strategy: plan.strategy,
    };
  }

  private resolveCarrierStart(
    orders: Array<Pick<Order, 'originLat' | 'originLng'>>,
    vehicle: { lastLat: number | null; lastLng: number | null } | null,
  ): [number, number] {
    if (vehicle?.lastLat != null && vehicle?.lastLng != null) {
      return [vehicle.lastLng, vehicle.lastLat];
    }
    const first = orders[0];
    return [first?.originLng ?? 0, first?.originLat ?? 0];
  }

  private async optimizeCarrierRouteViaVroom(
    orders: Order[],
    vehicle: { capacityTons: number } | null,
    start: [number, number],
  ): Promise<CarrierRoutePlan> {
    const capacityKg = vehicle ? Math.round(vehicle.capacityTons * 1000) : null;

    const jobIdMap = new Map<number, RouteStop>();
    const jobs: VroomJob[] = [];

    orders.forEach((order, index) => {
      const pickupId = index * 2;
      const deliveryId = index * 2 + 1;
      const amount = capacityKg
        ? [Math.max(1, Math.round(order.weight ?? 0))]
        : undefined;

      jobIdMap.set(pickupId, {
        orderId: order.id,
        action: 'pickup',
        lat: order.originLat!,
        lng: order.originLng!,
      });
      jobIdMap.set(deliveryId, {
        orderId: order.id,
        action: 'delivery',
        lat: order.destinationLat!,
        lng: order.destinationLng!,
      });

      jobs.push(
        {
          id: pickupId,
          location: [order.originLng!, order.originLat!],
          pickup: amount,
        },
        {
          id: deliveryId,
          location: [order.destinationLng!, order.destinationLat!],
          delivery: amount,
        },
      );
    });

    const response = await this.vroomService.optimize({
      jobs,
      vehicles: [
        {
          id: 1,
          profile: 'driving-car',
          start,
          capacity: capacityKg ? [capacityKg] : undefined,
        },
      ],
      options: { g: true },
    });

    if (response.code !== 0) {
      throw new BadGatewayException(
        response.error ?? 'VROOM failed to optimize carrier route',
      );
    }

    const route = response.routes?.[0];
    const decoded = this.vroomService.decodeRoute(route);

    const stops: RouteStop[] = (route?.steps ?? [])
      .map((step) => jobIdMap.get(Number(step.job)))
      .filter((stop): stop is RouteStop => Boolean(stop));

    return {
      route: {
        distanceKm: decoded.distanceKm,
        durationMinutes: decoded.durationMinutes,
        geometry: {
          type: 'LineString',
          coordinates: decoded.coordinates,
        },
      },
      stops,
      strategy: 'vroom',
    };
  }

  private optimizeCarrierRouteGreedy(
    orders: Order[],
    start: [number, number],
  ): CarrierRoutePlan {
    const pending = new Set(orders.map((order) => order.id));
    const delivered = new Set<string>();
    let current = start;
    const stops: RouteStop[] = [];
    let totalKm = 0;

    const buildCandidates = (): RouteStop[] => {
      const result: RouteStop[] = [];
      for (const order of orders) {
        if (pending.has(order.id)) {
          result.push({
            orderId: order.id,
            action: 'pickup',
            lat: order.originLat!,
            lng: order.originLng!,
          });
        } else if (!delivered.has(order.id)) {
          result.push({
            orderId: order.id,
            action: 'delivery',
            lat: order.destinationLat!,
            lng: order.destinationLng!,
          });
        }
      }
      return result;
    };

    let available = buildCandidates();
    while (available.length > 0) {
      let nearest: { stop: RouteStop; distance: number } | null = null;
      for (const stop of available) {
        const distance = haversineKm(
          current[1],
          current[0],
          stop.lat,
          stop.lng,
        );
        if (!nearest || distance < nearest.distance) {
          nearest = { stop, distance };
        }
      }

      if (!nearest) {
        break;
      }

      totalKm += nearest.distance;
      stops.push(nearest.stop);
      current = [nearest.stop.lng, nearest.stop.lat];

      if (nearest.stop.action === 'pickup') {
        pending.delete(nearest.stop.orderId);
      } else {
        delivered.add(nearest.stop.orderId);
      }
      available = buildCandidates();
    }

    const durationMinutes = Number(
      ((totalKm / RoutesService.FALLBACK_SPEED_KMH) * 60).toFixed(2),
    );

    return {
      route: {
        distanceKm: Number(totalKm.toFixed(2)),
        durationMinutes,
        geometry: {
          type: 'LineString',
          coordinates: [
            [start[0], start[1]],
            ...stops.map((stop) => [stop.lng, stop.lat]),
          ],
        },
      },
      stops,
      strategy: 'greedy',
    };
  }

  private async resolveParsedRoute(
    coords: Coordinates,
    allowStraightLineFallback: boolean,
  ): Promise<ParsedRoute> {
    const cacheKey = this.cacheKey(coords);
    const cached = this.routeCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.parsed;
    }

    if (this.vroomService.isConfigured()) {
      try {
        return await this.cacheParsedRoute(
          cacheKey,
          this.requestRouteViaVroom(coords),
        );
      } catch (error) {
        this.logger.warn(
          `VROOM routing failed for ${this.describe(coords)}: ${this.describeError(error)} — falling back to ORS`,
        );
      }
    }

    try {
      return await this.cacheParsedRoute(
        cacheKey,
        Promise.resolve(
          this.parseRouteResponse(await this.requestRoute(coords)),
        ),
      );
    } catch (error) {
      this.logger.warn(
        `ORS routing failed for ${this.describe(coords)}: ${this.describeError(error)}`,
      );
      if (!allowStraightLineFallback) {
        throw error;
      }
    }

    return this.cacheParsedRoute(
      cacheKey,
      Promise.resolve(this.buildStraightLineFallback(coords)),
    );
  }

  private cacheKey(coords: Coordinates): string {
    const round = (value: number) => value.toFixed(4);
    return `${round(coords.startLat)},${round(coords.startLng)}->${round(coords.endLat)},${round(coords.endLng)}`;
  }

  private async cacheParsedRoute(
    key: string,
    promise: Promise<ParsedRoute>,
  ): Promise<ParsedRoute> {
    const parsed = await promise;
    this.routeCache.set(key, {
      parsed,
      expiresAt: Date.now() + RoutesService.ROUTE_CACHE_TTL_MS,
    });
    return parsed;
  }

  private buildStraightLineFallback(coords: Coordinates): ParsedRoute {
    const distanceKm = haversineKm(
      coords.startLat,
      coords.startLng,
      coords.endLat,
      coords.endLng,
    );
    const durationMinutes = Number(
      ((distanceKm / RoutesService.FALLBACK_SPEED_KMH) * 60).toFixed(2),
    );

    return {
      distanceKm: Number(distanceKm.toFixed(2)),
      durationMinutes,
      geometry: {
        type: 'LineString',
        coordinates: [
          [coords.startLng, coords.startLat],
          [coords.endLng, coords.endLat],
        ],
      },
    };
  }

  private describe(coords: Coordinates): string {
    return `[${coords.startLat},${coords.startLng} -> ${coords.endLat},${coords.endLng}]`;
  }

  private describeError(error: unknown): string {
    if (error instanceof AxiosError) {
      const data = error.response?.data as { error?: string } | undefined;
      return typeof data?.error === 'string'
        ? data.error
        : (error.message ?? 'unknown error');
    }
    if (error instanceof Error) {
      return error.message;
    }
    return String(error);
  }

  private resolveCoordinates(
    dto: CalculateRouteDto,
    order: Pick<
      Order,
      'originLat' | 'originLng' | 'destinationLat' | 'destinationLng'
    > | null,
  ): Coordinates {
    const startLat = dto.startLat ?? order?.originLat ?? undefined;
    const startLng = dto.startLng ?? order?.originLng ?? undefined;
    const endLat = dto.endLat ?? order?.destinationLat ?? undefined;
    const endLng = dto.endLng ?? order?.destinationLng ?? undefined;

    if (
      startLat === undefined ||
      startLng === undefined ||
      endLat === undefined ||
      endLng === undefined
    ) {
      throw new BadRequestException(
        'Route coordinates are required. Provide start/end coordinates or an order with saved coordinates.',
      );
    }

    return { startLat, startLng, endLat, endLng };
  }

  private async requestRouteViaVroom(
    coords: Coordinates,
  ): Promise<ParsedRoute> {
    const origin: [number, number] = [coords.startLng, coords.startLat];
    const destination: [number, number] = [coords.endLng, coords.endLat];

    const response = await this.vroomService.optimize({
      jobs: [{ id: 1, location: destination }],
      vehicles: [
        {
          id: 1,
          profile: 'driving-car',
          start: origin,
          end: destination,
        },
      ],
      options: { g: true },
    });

    if (response.code !== 0) {
      throw new BadGatewayException(
        response.error ?? 'VROOM failed to optimize the route',
      );
    }

    const route = response.routes?.[0];
    const decoded = this.vroomService.decodeRoute(route);

    return {
      distanceKm: decoded.distanceKm,
      durationMinutes: decoded.durationMinutes,
      geometry: {
        type: 'LineString',
        coordinates: decoded.coordinates,
      },
    };
  }

  private async requestRoute(coords: Coordinates) {
    const apiKey = process.env.OPENROUTESERVICE_API_KEY;
    if (!apiKey) {
      throw new InternalServerErrorException(
        'OPENROUTESERVICE_API_KEY is not configured',
      );
    }

    const baseUrl =
      process.env.OPENROUTESERVICE_BASE_URL?.replace(/\/$/, '') ??
      'https://api.openrouteservice.org';
    const endpoint = `${baseUrl}/v2/directions/driving-car/geojson`;

    try {
      const response = await firstValueFrom(
        this.httpService.post<OrsDirectionsResponse>(
          endpoint,
          {
            coordinates: [
              [coords.startLng, coords.startLat],
              [coords.endLng, coords.endLat],
            ],
          },
          {
            headers: {
              Authorization: apiKey,
              'Content-Type': 'application/json',
            },
            timeout: 15000,
          },
        ),
      );

      return response.data;
    } catch (error) {
      this.mapOrsError(error);
    }
  }

  private parseRouteResponse(data: OrsDirectionsResponse): ParsedRoute {
    const feature = data.features?.[0];
    const geometry = feature?.geometry;
    const summary = feature?.properties?.summary;

    if (
      !geometry ||
      geometry.type !== 'LineString' ||
      !Array.isArray(geometry.coordinates) ||
      typeof summary?.distance !== 'number' ||
      typeof summary?.duration !== 'number'
    ) {
      throw new BadGatewayException(
        'OpenRouteService returned an invalid route payload',
      );
    }

    return {
      distanceKm: Number((summary.distance / 1000).toFixed(2)),
      durationMinutes: Number((summary.duration / 60).toFixed(2)),
      geometry: {
        type: geometry.type,
        coordinates: geometry.coordinates,
      },
    };
  }

  private async findVisibleOrderOrThrow(authUser: AuthUser, orderId: string) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
    });
    if (!order) {
      throw new NotFoundException('Order not found');
    }

    if (authUser.role === UserRole.SUPERADMIN) {
      return order;
    }

    if (order.clientId === authUser.id) {
      return order;
    }

    if (await this.isAssignedCarrier(authUser.id, order)) {
      return order;
    }

    throw new NotFoundException('Order not found');
  }

  private async isAssignedCarrier(userId: string, order: Order) {
    if (!order.carrierId) {
      return false;
    }

    const carrierProfile =
      await this.carrierProfileRepository.findByUserId(userId);
    return carrierProfile?.id === order.carrierId;
  }

  private mapOrsError(error: unknown): never {
    if (error instanceof AxiosError) {
      if (!error.response) {
        throw new BadGatewayException('OpenRouteService is unavailable');
      }

      const status = error.response.status;
      const data = error.response.data as OrsErrorResponse | undefined;
      const message =
        typeof data?.error === 'string'
          ? data.error
          : (data?.error?.message ??
            data?.message ??
            'OpenRouteService request failed');

      if (status === 400 || status === 404) {
        throw new BadRequestException(message);
      }

      if (status === 401 || status === 403) {
        throw new BadGatewayException(
          'OpenRouteService rejected the configured API key',
        );
      }

      if (status === 429) {
        throw new BadGatewayException('OpenRouteService rate limit exceeded');
      }

      throw new BadGatewayException(message);
    }

    throw new BadGatewayException('OpenRouteService request failed');
  }
}

export function haversineKm(
  startLat: number,
  startLng: number,
  endLat: number,
  endLng: number,
): number {
  const toRadians = (degrees: number) => (degrees * Math.PI) / 180;
  const earthRadiusKm = 6371;

  const dLat = toRadians(endLat - startLat);
  const dLng = toRadians(endLng - startLng);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(startLat)) *
      Math.cos(toRadians(endLat)) *
      Math.sin(dLng / 2) ** 2;

  return 2 * earthRadiusKm * Math.asin(Math.sqrt(a));
}
