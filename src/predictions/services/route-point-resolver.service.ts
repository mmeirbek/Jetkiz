import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

const EARTH_RADIUS_KM = 6371;

function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

function haversineKm(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return EARTH_RADIUS_KM * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

@Injectable()
export class RoutePointResolverService {
  constructor(private readonly prisma: PrismaService) {}

  getWeatherWaypoints(
    geometry: number[][],
    count: number = 5,
  ): Array<{ lat: number; lng: number }> {
    if (geometry.length === 0) {
      return [];
    }

    if (geometry.length <= count) {
      return geometry.map(([lng, lat]) => ({ lat, lng }));
    }

    const indices: number[] = [];
    for (let i = 0; i < count; i++) {
      const idx = Math.round((i * (geometry.length - 1)) / (count - 1));
      indices.push(idx);
    }

    return indices.map((i) => {
      const [lng, lat] = geometry[i];
      return { lat, lng };
    });
  }

  async findNearbyCheckpoints(
    geometry: number[][],
    maxDistanceKm: number = 50,
  ) {
    const checkpoints = await this.safeFindMany(() =>
      this.prisma.checkpoint.findMany(),
    );
    const routePoints = this.sampleGeometry(geometry, 100);

    return checkpoints.filter((cp) =>
      this.isPointNearRoute(
        cp.latitude,
        cp.longitude,
        routePoints,
        maxDistanceKm,
      ),
    );
  }

  async findNearbyRailwayNodes(
    geometry: number[][],
    maxDistanceKm: number = 50,
  ) {
    const nodes = await this.safeFindMany(() =>
      this.prisma.trainSchedule.findMany(),
    );
    const routePoints = this.sampleGeometry(geometry, 100);

    return nodes.filter((node) =>
      this.isPointNearRoute(
        node.latitude,
        node.longitude,
        routePoints,
        maxDistanceKm,
      ),
    );
  }

  private async safeFindMany<T>(query: () => Promise<T[]>): Promise<T[]> {
    try {
      return await query();
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2021'
      ) {
        return [];
      }
      throw error;
    }
  }

  private sampleGeometry(
    geometry: number[][],
    maxPoints: number,
  ): Array<{ lat: number; lng: number }> {
    if (geometry.length <= maxPoints) {
      return geometry.map(([lng, lat]) => ({ lat, lng }));
    }

    const step = geometry.length / maxPoints;
    const result: Array<{ lat: number; lng: number }> = [];

    for (let i = 0; i < maxPoints; i++) {
      const idx = Math.floor(i * step);
      const [lng, lat] = geometry[idx];
      result.push({ lat, lng });
    }

    return result;
  }

  private isPointNearRoute(
    lat: number,
    lng: number,
    routePoints: Array<{ lat: number; lng: number }>,
    maxDistanceKm: number,
  ): boolean {
    for (const rp of routePoints) {
      if (haversineKm(lat, lng, rp.lat, rp.lng) <= maxDistanceKm) {
        return true;
      }
    }
    return false;
  }
}
