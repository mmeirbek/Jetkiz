import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { IS_PUBLIC_KEY } from '../constants/auth.constants';
import { UsersRepository } from '../../users/repositories/users.repository';
import { TokenService } from '../../auth/services/token.service';
import type { AuthUser } from '../types/auth-user.type';

export type AuthenticatedRequest = Request & { authUser: AuthUser };

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly tokenService: TokenService,
    private readonly usersRepository: UsersRepository,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const token = this.extractBearerToken(request);
    if (!token) {
      throw new UnauthorizedException('Missing Bearer token');
    }

    const payload = await this.tokenService.verifyAccessToken(token);
    const user = await this.usersRepository.findById(payload.sub);

    if (!user || !user.isActive) {
      throw new UnauthorizedException('User is not active');
    }

    request.authUser = {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      phone: user.phone,
      role: user.role,
      isActive: user.isActive,
    };

    return true;
  }

  private extractBearerToken(request: Request): string | null {
    const rawAuth = request.headers.authorization;
    if (!rawAuth) {
      return null;
    }

    const [scheme, token] = rawAuth.split(' ');
    if (scheme !== 'Bearer' || !token) {
      return null;
    }

    return token.trim();
  }
}
