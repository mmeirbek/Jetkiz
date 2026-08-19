import { Injectable } from '@nestjs/common';
import { Prisma, Route } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class RoutesRepository {
  constructor(private readonly prisma: PrismaService) {}

  create(data: {
    orderId: string | null;
    distanceKm: number;
    durationMinutes: number;
    geometry: Prisma.InputJsonValue;
  }): Promise<Route> {
    return this.prisma.route.create({ data });
  }
}
