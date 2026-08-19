import {
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import type { Request } from 'express';

const DEFAULT_ME_RATE_LIMIT_MAX = 120;
const DEFAULT_ME_RATE_LIMIT_WINDOW_SEC = 60;

type RateLimitRequest = Request & { authUser?: { id: string } };

@Injectable()
export class MeRateLimitGuard implements CanActivate {
  private readonly attempts = new Map<string, number[]>();
  private readonly maxAttempts = this.resolveMaxAttempts();
  private readonly windowMs = this.resolveWindowMs();

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<RateLimitRequest>();
    const now = Date.now();
    const key = this.resolveClientKey(request);
    const threshold = now - this.windowMs;

    const recent = (this.attempts.get(key) ?? []).filter(
      (timestamp) => timestamp >= threshold,
    );
    if (recent.length >= this.maxAttempts) {
      throw new HttpException(
        'Too many profile requests. Please try again later.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    recent.push(now);
    this.attempts.set(key, recent);
    return true;
  }

  private resolveClientKey(request: RateLimitRequest): string {
    const userId = request.authUser?.id;
    if (userId) {
      return `user:${userId}`;
    }

    const xForwardedFor = request.get('x-forwarded-for');
    if (xForwardedFor) {
      const first = xForwardedFor.split(',')[0]?.trim();
      if (first) {
        return `ip:${first}`;
      }
    }

    return `ip:${request.ip ?? 'unknown'}`;
  }

  private resolveMaxAttempts(): number {
    const raw = process.env.ME_RATE_LIMIT_MAX?.trim();
    if (!raw) {
      return DEFAULT_ME_RATE_LIMIT_MAX;
    }

    const parsed = Number(raw);
    if (!Number.isFinite(parsed) || parsed < 1 || parsed > 1000) {
      throw new Error('ME_RATE_LIMIT_MAX must be between 1 and 1000');
    }

    return Math.floor(parsed);
  }

  private resolveWindowMs(): number {
    const raw = process.env.ME_RATE_LIMIT_WINDOW_SEC?.trim();
    if (!raw) {
      return DEFAULT_ME_RATE_LIMIT_WINDOW_SEC * 1000;
    }

    const parsed = Number(raw);
    if (!Number.isFinite(parsed) || parsed < 1 || parsed > 3600) {
      throw new Error('ME_RATE_LIMIT_WINDOW_SEC must be between 1 and 3600');
    }

    return Math.floor(parsed) * 1000;
  }
}
