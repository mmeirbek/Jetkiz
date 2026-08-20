import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AuthUser } from '../../common/types/auth-user.type';
import { PrismaService } from '../../prisma/prisma.service';
import {
  OpenWeatherService,
  WeatherPoint,
} from '../../predictions/services/open-weather.service';
import { RoutePointResolverService } from '../../predictions/services/route-point-resolver.service';
import { RoutesService } from '../../routes/services/routes.service';

type Warning = {
  type: string;
  severity: 'info' | 'warning' | 'critical';
  message: string;
};

type GeoJsonLineString = {
  coordinates: number[][];
};

@Injectable()
export class RouteConditionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly routesService: RoutesService,
    private readonly openWeatherService: OpenWeatherService,
    private readonly routePointResolver: RoutePointResolverService,
  ) {}

  async getForOrder(orderId: string) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
    });
    if (!order) {
      throw new NotFoundException('Order not found');
    }

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

    const route = await this.routesService.calculate(this.actor(), {
      startLat: order.originLat,
      startLng: order.originLng,
      endLat: order.destinationLat,
      endLng: order.destinationLng,
    });

    const routeGeometry =
      (route.geometry as unknown as GeoJsonLineString).coordinates ?? [];
    const weather = await this.fetchWeather(routeGeometry);
    const conditions = this.summarize(weather);
    const checkpoints = await this.routePointResolver.findNearbyCheckpoints(
      routeGeometry,
      50,
    );

    const distanceKm = Number(route.distanceKm);
    const durationMinutes = Number(route.durationMinutes);

    return {
      orderId,
      origin: order.origin,
      destination: order.destination,
      distanceKm,
      durationMinutes,
      etaMinutes: durationMinutes + conditions.estimatedDelayMinutes,
      conditions,
      weather: weather ?? null,
      nearbyCheckpoints: checkpoints.map((c) => ({
        name: c.name,
        loadPercent: c.loadPercent,
      })),
      warnings: conditions.warnings,
      weatherAvailable: weather !== null,
      generatedAt: new Date().toISOString(),
    };
  }

  private async fetchWeather(
    geometryCoordinates: number[][],
  ): Promise<WeatherPoint[] | null> {
    const apiKey = process.env.OPENWEATHER_API_KEY;
    if (!apiKey || apiKey.startsWith('your-')) {
      return null;
    }

    const waypoints = this.routePointResolver.getWeatherWaypoints(
      geometryCoordinates,
      5,
    );

    return this.openWeatherService.getWeatherForPoints(waypoints);
  }

  private summarize(points: WeatherPoint[] | null) {
    const empty = {
      maxTemperature: null,
      minTemperature: null,
      maxWindMs: null,
      rain: false,
      snow: false,
      dust: false,
      warnings: [] as Warning[],
      estimatedDelayMinutes: 0,
    };

    if (!points || points.length === 0) {
      return empty;
    }

    const temperatures = points
      .filter((p) => p.temperature !== 0)
      .map((p) => p.temperature);
    const windSpeeds = points.map((p) => p.windSpeed);
    const rain = points.some((p) => p.rain);
    const snow = points.some((p) => p.snow);
    const dust = points.some((p) => /sand|dust|haze/i.test(p.description));

    const maxTemperature = temperatures.length
      ? Math.max(...temperatures)
      : null;
    const minTemperature = temperatures.length
      ? Math.min(...temperatures)
      : null;
    const maxWindMs = windSpeeds.length ? Math.max(...windSpeeds) : null;

    const warnings: Warning[] = [];
    let estimatedDelayMinutes = 0;

    if (maxTemperature != null && maxTemperature >= 35) {
      warnings.push({
        type: 'HEAT',
        severity: 'warning',
        message: `Жара до ${maxTemperature}°C — риск для скоропортящихся грузов`,
      });
      estimatedDelayMinutes += 15;
    }

    if (dust) {
      warnings.push({
        type: 'DUST',
        severity: 'warning',
        message: 'На маршруте возможны пыльные бури — снизьте скорость',
      });
      estimatedDelayMinutes += 30;
    }

    if (rain) {
      warnings.push({
        type: 'RAIN',
        severity: 'info',
        message: 'На маршруте осадки — ожидайте небольшой задержки',
      });
      estimatedDelayMinutes += 10;
    }

    if (maxWindMs != null && maxWindMs >= 15) {
      warnings.push({
        type: 'WIND',
        severity: 'info',
        message: `Сильный ветер до ${maxWindMs} м/с`,
      });
      estimatedDelayMinutes += 10;
    }

    return {
      maxTemperature,
      minTemperature,
      maxWindMs,
      rain,
      snow,
      dust,
      warnings,
      estimatedDelayMinutes,
    };
  }

  private actor(): AuthUser {
    return {
      id: 'system',
      email: 'system@caspex.local',
      firstName: 'System',
      lastName: 'RouteConditions',
      phone: '',
      role: 'SUPERADMIN',
      isActive: true,
    };
  }
}
