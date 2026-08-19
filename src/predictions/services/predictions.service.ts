import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { RoutesService } from '../../routes/services/routes.service';
import { AggregatorService } from './aggregator.service';
import { OpenAiService } from './open-ai.service';
import { OpenWeatherService } from './open-weather.service';
import { RoutePointResolverService } from './route-point-resolver.service';

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

  async predictLand(orderId: string) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
    });
    if (!order) {
      throw new NotFoundException('Order not found');
    }

    const { originLat, originLng, destinationLat, destinationLng } = order;
    if (
      originLat == null ||
      originLng == null ||
      destinationLat == null ||
      destinationLng == null
    ) {
      throw new BadRequestException(
        'Order has no coordinates. Set origin and destination coordinates first.',
      );
    }

    const route = await this.routesService.calculate(
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
        startLat: originLat,
        startLng: originLng,
        endLat: destinationLat,
        endLng: destinationLng,
      },
    );

    const waypoints = this.routePointResolver.getWeatherWaypoints(
      route.geometry.coordinates,
      5,
    );

    const [weatherPoints, nearbyCheckpoints, nearbyRailway] = await Promise.all(
      [
        this.openWeatherService.getWeatherForPoints(waypoints),
        this.routePointResolver.findNearbyCheckpoints(
          route.geometry.coordinates,
          50,
        ),
        this.routePointResolver.findNearbyRailwayNodes(
          route.geometry.coordinates,
          50,
        ),
      ],
    );

    const aggregated = this.aggregatorService.aggregate(
      { distanceKm: route.distanceKm, durationMinutes: route.durationMinutes },
      weatherPoints,
      nearbyCheckpoints,
      nearbyRailway,
    );

    const prediction = await this.openAiService.predict(aggregated);

    return { orderId, ...prediction };
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
      bestDepartureTime: new Date().toISOString(),
      expectedDelayMinutes: 0,
      shortExplanation: 'Морской маршрут свободен.',
    };
  }
}
