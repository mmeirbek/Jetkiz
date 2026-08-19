import { Injectable } from '@nestjs/common';
import type { Checkpoint, TrainSchedule } from '@prisma/client';
import type { WeatherPoint } from './open-weather.service';

export type AggregatedInput = {
  route: {
    distanceKm: number;
    durationHours: number;
  };
  weather: {
    risk: 'low' | 'medium' | 'high';
    wind: number;
    rain: boolean;
  };
  checkpoints: Array<{
    name: string;
    load: number;
    wait: number;
  }>;
  railway: Array<{
    station: string;
    load: number;
  }>;
};

@Injectable()
export class AggregatorService {
  aggregate(
    route: {
      distanceKm: number;
      durationMinutes: number;
    },
    weatherPoints: WeatherPoint[],
    checkpoints: Checkpoint[],
    railwayNodes: TrainSchedule[],
  ): AggregatedInput {
    const weather = this.aggregateWeather(weatherPoints);

    return {
      route: {
        distanceKm: route.distanceKm,
        durationHours: Number((route.durationMinutes / 60).toFixed(1)),
      },
      weather,
      checkpoints: checkpoints.map((cp) => ({
        name: cp.name,
        load: cp.loadPercent,
        wait: cp.avgWaitMinutes,
      })),
      railway: railwayNodes.map((rn) => ({
        station: rn.stationName,
        load: rn.currentLoad,
      })),
    };
  }

  private aggregateWeather(points: WeatherPoint[]): AggregatedInput['weather'] {
    if (points.length === 0) {
      return { risk: 'low', wind: 0, rain: false };
    }

    const maxWind = Math.max(...points.map((p) => p.windSpeed));
    const hasRain = points.some((p) => p.rain);

    let risk: 'low' | 'medium' | 'high' = 'low';
    if (maxWind > 20 || hasRain) {
      risk = 'medium';
    }
    if (maxWind > 30) {
      risk = 'high';
    }

    return { risk, wind: maxWind, rain: hasRain };
  }
}
