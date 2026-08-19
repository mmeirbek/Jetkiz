import { HttpService } from '@nestjs/axios';
import {
  BadGatewayException,
  BadRequestException,
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';
import { AxiosError } from 'axios';
import { firstValueFrom } from 'rxjs';

export type VroomLocation = [number, number];

export type VroomJob = {
  id: string | number;
  location: VroomLocation;
  service?: number;
  setup?: number;
  time_windows?: Array<[number, number]>;
};

export type VroomVehicle = {
  id: string | number;
  profile?: string;
  start?: VroomLocation;
  end?: VroomLocation;
  capacity?: number[];
  time_window?: [number, number];
};

export type VroomStep = {
  type: 'start' | 'job' | 'delivery' | 'pickup' | 'end' | 'break';
  id?: string | number;
  job?: string | number;
  location?: VroomLocation;
  travel_time?: number;
  distance?: number;
  setup?: number;
  service?: number;
  geometry?: string;
};

export type VroomRoute = {
  vehicle: string | number;
  cost?: number;
  delivery?: number[];
  distance?: number;
  duration?: number;
  geometry?: string;
  steps: VroomStep[];
};

export type VroomResponse = {
  code: number;
  summary?: {
    cost?: number;
    routes?: number;
    unassigned?: number;
    delivery?: number[];
    distance?: number;
    duration?: number;
  };
  unassigned?: Array<{ id: string | number; location: VroomLocation }>;
  routes?: VroomRoute[];
  error?: string;
};

export type VroomRequest = {
  jobs: VroomJob[];
  vehicles: VroomVehicle[];
  options?: {
    g?: boolean;
    c?: boolean;
    t?: number;
    x?: number;
    l?: number;
  };
};

export type DecodedRouteGeometry = {
  distanceKm: number;
  durationMinutes: number;
  coordinates: VroomLocation[];
};

@Injectable()
export class VroomService {
  constructor(private readonly httpService: HttpService) {}

  isConfigured(): boolean {
    return Boolean(process.env.VROOM_URL);
  }

  async optimize(request: VroomRequest): Promise<VroomResponse> {
    const baseUrl = process.env.VROOM_URL?.replace(/\/$/, '');
    if (!baseUrl) {
      throw new InternalServerErrorException('VROOM_URL is not configured');
    }

    try {
      const response = await firstValueFrom(
        this.httpService.post<VroomResponse>(`${baseUrl}/`, request, {
          timeout: 60000,
        }),
      );
      return response.data;
    } catch (error) {
      this.mapError(error);
    }
  }

  decodeRoute(route: VroomRoute | undefined): DecodedRouteGeometry {
    if (
      !route ||
      typeof route.distance !== 'number' ||
      typeof route.duration !== 'number'
    ) {
      throw new BadGatewayException('VROOM returned an invalid route payload');
    }

    const coordinates: VroomLocation[] = [];

    if (typeof route.geometry === 'string' && route.geometry.length > 0) {
      const decoded = decodePolyline(route.geometry);
      for (const point of decoded) {
        const last = coordinates[coordinates.length - 1];
        if (!last || last[0] !== point[0] || last[1] !== point[1]) {
          coordinates.push(point);
        }
      }
    } else {
      for (const step of route.steps ?? []) {
        if (step.geometry) {
          const decoded = decodePolyline(step.geometry);
          for (const point of decoded) {
            const last = coordinates[coordinates.length - 1];
            if (!last || last[0] !== point[0] || last[1] !== point[1]) {
              coordinates.push(point);
            }
          }
        }
      }
    }

    if (coordinates.length === 0) {
      throw new BadGatewayException('VROOM returned no route geometry');
    }

    return {
      distanceKm: Number((route.distance / 1000).toFixed(2)),
      durationMinutes: Number((route.duration / 60).toFixed(2)),
      coordinates,
    };
  }

  private mapError(error: unknown): never {
    if (error instanceof AxiosError) {
      if (!error.response) {
        throw new BadGatewayException('VROOM is unavailable');
      }

      const data = error.response.data as
        | { code?: number; error?: string }
        | undefined;

      if (data?.code === 2) {
        throw new BadRequestException(
          data.error ?? 'VROOM rejected the request input',
        );
      }

      if (data?.code === 3) {
        throw new BadGatewayException(
          data.error ?? 'VROOM routing backend failed',
        );
      }

      throw new BadGatewayException(data?.error ?? 'VROOM request failed');
    }

    throw new BadGatewayException('VROOM request failed');
  }
}

export function decodePolyline(encoded: string): VroomLocation[] {
  const coordinates: VroomLocation[] = [];
  let index = 0;
  let lat = 0;
  let lng = 0;

  while (index < encoded.length) {
    let result = 0;
    let shift = 0;
    let byte: number;
    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);
    const deltaLat = result & 1 ? ~(result >> 1) : result >> 1;
    lat += deltaLat;

    result = 0;
    shift = 0;
    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);
    const deltaLng = result & 1 ? ~(result >> 1) : result >> 1;
    lng += deltaLng;

    coordinates.push([lng / 1e5, lat / 1e5]);
  }

  return coordinates;
}
