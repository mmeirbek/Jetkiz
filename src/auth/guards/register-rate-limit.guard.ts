import {
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import type { Request } from 'express';

const DEFAULT_REGISTER_RATE_LIMIT_MAX = 5;
const DEFAULT_REGISTER_RATE_LIMIT_WINDOW_SEC = 60;

@Injectable()
export class RegisterRateLimitGuard implements CanActivate {
  private readonly attempts = new Map<string, number[]>();
  private readonly maxAttempts = this.resolveMaxAttempts();
  private readonly windowMs = this.resolveWindowMs();

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const now = Date.now();
    const key = this.resolveClientKey(request);
    const threshold = now - this.windowMs;

    const recent = (this.attempts.get(key) ?? []).filter(
      (ts) => ts >= threshold,
    );
    if (recent.length >= this.maxAttempts) {
      throw new HttpException(
        'Too many registration attempts. Please try again later.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    recent.push(now);
    this.attempts.set(key, recent);
    return true;
  }

  private resolveClientKey(request: Request): string {
    const xForwardedFor = request.get('x-forwarded-for');
    if (xForwardedFor) {
      const first = xForwardedFor.split(',')[0]?.trim();
      if (first) {
        return first;
      }
    }

    return request.ip ?? 'unknown';
  }

  private resolveMaxAttempts(): number {
    const raw = process.env.REGISTRATION_RATE_LIMIT_MAX?.trim();
    if (!raw) {
      return DEFAULT_REGISTER_RATE_LIMIT_MAX;
    }

    const parsed = Number(raw);
    if (!Number.isFinite(parsed) || parsed < 1 || parsed > 100) {
      throw new Error('REGISTRATION_RATE_LIMIT_MAX must be between 1 and 100');
    }

    return Math.floor(parsed);
  }

  private resolveWindowMs(): number {
    const raw = process.env.REGISTRATION_RATE_LIMIT_WINDOW_SEC?.trim();
    if (!raw) {
      return DEFAULT_REGISTER_RATE_LIMIT_WINDOW_SEC * 1000;
    }

    const parsed = Number(raw);
    if (!Number.isFinite(parsed) || parsed < 1 || parsed > 3600) {
      throw new Error(
        'REGISTRATION_RATE_LIMIT_WINDOW_SEC must be between 1 and 3600',
      );
    }

    return Math.floor(parsed) * 1000;
  }
}
