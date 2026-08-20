import { HttpService } from '@nestjs/axios';
import { Injectable } from '@nestjs/common';
import { firstValueFrom } from 'rxjs';
import { PrismaService } from '../prisma/prisma.service';

export type GeocodeResult = {
  label: string;
  latitude: number;
  longitude: number;
  settlementId: string | null;
  source: 'local' | 'osm';
};

type NominatimItem = {
  display_name: string;
  lat: string;
  lon: string;
  type?: string;
  name?: string;
};

// Mangystau region bounding box: lon 49.0..56.5, lat 42.0..46.5
const VIEWBOX = '49.0,42.0,56.5,46.5';

@Injectable()
export class GeocodeService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly httpService: HttpService,
  ) {}

  async search(query: string): Promise<GeocodeResult[]> {
    const q = query.trim();
    if (q.length < 2) return [];

    const local = await this.searchLocal(q);
    const osm = await this.searchOsm(q);

    const seenKeys = new Set<string>();
    const results: GeocodeResult[] = [];
    for (const r of [...local, ...osm]) {
      const key = `${r.latitude.toFixed(4)},${r.longitude.toFixed(4)}`;
      if (seenKeys.has(key)) continue;
      seenKeys.add(key);
      results.push(r);
    }
    return results.slice(0, 8);
  }

  private async searchLocal(q: string): Promise<GeocodeResult[]> {
    const settlements = await this.prisma.settlement.findMany({
      where: {
        OR: [
          { name: { contains: q, mode: 'insensitive' } },
          { nameRu: { contains: q, mode: 'insensitive' } },
          { nameKk: { contains: q, mode: 'insensitive' } },
          { district: { contains: q, mode: 'insensitive' } },
        ],
      },
      take: 5,
    });

    return settlements.map((s) => ({
      label: `${s.nameRu} · ${s.district} (${s.type})`,
      latitude: s.latitude,
      longitude: s.longitude,
      settlementId: s.id,
      source: 'local' as const,
    }));
  }

  private async searchOsm(q: string): Promise<GeocodeResult[]> {
    try {
      const { data } = await firstValueFrom(
        this.httpService.get<NominatimItem[]>(
          'https://nominatim.openstreetmap.org/search',
          {
            params: {
              q,
              format: 'json',
              countrycodes: 'kz',
              limit: 6,
              viewbox: VIEWBOX,
              bounded: 0,
              addressdetails: 0,
              'accept-language': 'ru',
            },
            headers: {
              'User-Agent': 'CaspX-Web/1.0 (demo)',
            },
            timeout: 8000,
          },
        ),
      );

      return (data ?? [])
        .filter((item) => item.lat && item.lon)
        .map((item) => ({
          label: item.display_name,
          latitude: Number(item.lat),
          longitude: Number(item.lon),
          settlementId: null,
          source: 'osm' as const,
        }));
    } catch {
      // network / rate-limit / any OSM failure — local matches still apply
      return [];
    }
  }
}