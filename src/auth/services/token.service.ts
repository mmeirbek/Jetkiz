import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UserRole } from '@prisma/client';
import { randomUUID } from 'crypto';
import {
  DEFAULT_ACCESS_TTL,
  DEFAULT_REFRESH_TTL,
} from '../../common/constants/auth.constants';
import { durationToSeconds } from '../../common/utils/duration.util';

export type AccessTokenPayload = {
  sub: string;
  role: UserRole;
  tokenType: 'access';
  jti?: string;
};

export type RefreshTokenPayload = {
  sub: string;
  tokenType: 'refresh';
  jti?: string;
};

@Injectable()
export class TokenService {
  private readonly accessSecret = this.getEnvOrThrow('JWT_ACCESS_SECRET');
  private readonly refreshSecret = this.getEnvOrThrow('JWT_REFRESH_SECRET');
  private readonly accessTtlSeconds = durationToSeconds(
    process.env.JWT_ACCESS_TTL ?? DEFAULT_ACCESS_TTL,
    DEFAULT_ACCESS_TTL,
  );
  private readonly refreshTtlSeconds = durationToSeconds(
    process.env.JWT_REFRESH_TTL ?? DEFAULT_REFRESH_TTL,
    DEFAULT_REFRESH_TTL,
  );

  constructor(private readonly jwtService: JwtService) {}

  async issueTokenPair(params: { userId: string; role: UserRole }) {
    const accessPayload: AccessTokenPayload = {
      sub: params.userId,
      role: params.role,
      tokenType: 'access',
      jti: randomUUID(),
    };

    const refreshPayload: RefreshTokenPayload = {
      sub: params.userId,
      tokenType: 'refresh',
      jti: randomUUID(),
    };

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(accessPayload, {
        secret: this.accessSecret,
        expiresIn: this.accessTtlSeconds,
      }),
      this.jwtService.signAsync(refreshPayload, {
        secret: this.refreshSecret,
        expiresIn: this.refreshTtlSeconds,
      }),
    ]);

    return {
      accessToken,
      refreshToken,
      accessExpiresAt: new Date(Date.now() + this.accessTtlSeconds * 1000),
      refreshExpiresAt: new Date(Date.now() + this.refreshTtlSeconds * 1000),
    };
  }

  async verifyAccessToken(token: string): Promise<AccessTokenPayload> {
    try {
      const payload = await this.jwtService.verifyAsync<AccessTokenPayload>(
        token,
        {
          secret: this.accessSecret,
        },
      );

      if (payload.tokenType !== 'access') {
        throw new UnauthorizedException('Invalid token type');
      }

      return payload;
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }

      throw new UnauthorizedException('Invalid or expired access token');
    }
  }

  async verifyRefreshToken(token: string): Promise<RefreshTokenPayload> {
    try {
      const payload = await this.jwtService.verifyAsync<RefreshTokenPayload>(
        token,
        {
          secret: this.refreshSecret,
        },
      );

      if (payload.tokenType !== 'refresh') {
        throw new UnauthorizedException('Invalid token type');
      }

      return payload;
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }

      throw new UnauthorizedException('Invalid or expired refresh token');
    }
  }

  getRefreshTtlSeconds() {
    return this.refreshTtlSeconds;
  }

  private getEnvOrThrow(name: string): string {
    const value = process.env[name]?.trim();
    if (!value) {
      throw new Error(`Missing required environment variable: ${name}`);
    }

    return value;
  }
}
