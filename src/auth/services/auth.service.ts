import {
  BadRequestException,
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { Request } from 'express';
import { DEFAULT_BCRYPT_ROUNDS } from '../../common/constants/auth.constants';
import { AuthUser } from '../../common/types/auth-user.type';
import { hashPassword, verifyPassword } from '../../common/utils/password.util';
import { extractRequestMeta } from '../../common/utils/request-meta.util';
import { hashToken } from '../../common/utils/token.util';
import { toUserResponse } from '../../common/utils/user-response.util';
import { UsersRepository } from '../../users/repositories/users.repository';
import { LoginDto } from '../dto/login.dto';
import { LogoutDto } from '../dto/logout.dto';
import { RefreshDto } from '../dto/refresh.dto';
import { RegisterDto } from '../dto/register.dto';
import { RefreshTokenRepository } from '../repositories/refresh-token.repository';
import { TokenService } from './token.service';

@Injectable()
export class AuthService {
  private readonly bcryptRounds = this.resolveBcryptRounds();

  constructor(
    private readonly usersRepository: UsersRepository,
    private readonly refreshTokenRepository: RefreshTokenRepository,
    private readonly tokenService: TokenService,
  ) {}

  async register(_actor: AuthUser | undefined, dto: RegisterDto) {
    if (dto.role === UserRole.ADMIN || dto.role === UserRole.SUPERADMIN) {
      throw new BadRequestException('This role cannot be registered publicly');
    }

    const existingUser = await this.usersRepository.findByEmail(dto.email);

    if (existingUser) {
      throw new ConflictException('User with this email already exists');
    }

    const passwordHash = await hashPassword(dto.password, this.bcryptRounds);

    const createdUser = await this.usersRepository.create({
      email: dto.email,
      passwordHash,
      role: dto.role,
      firstName: dto.firstName,
      lastName: dto.lastName,
      phone: dto.phone,
      personalDataConsentAt: new Date(),
      privacyPolicyConsentAt: new Date(),
      avatarUrl: dto.avatarUrl ?? null,
      companyName: dto.companyName ?? null,
      companyLogo: dto.companyLogo ?? null,
      city: dto.city ?? null,
      country: dto.country ?? null,
    });

    if (dto.role === UserRole.CARRIER) {
      await this.usersRepository.createCarrierProfile(createdUser.id);
    }

    return { user: toUserResponse(createdUser) };
  }

  async login(dto: LoginDto, request: Request) {
    const user = await this.usersRepository.findByEmail(dto.email);

    if (!user || !user.isActive) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const passwordOk = await verifyPassword(dto.password, user.passwordHash);
    if (!passwordOk) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const tokenPair = await this.tokenService.issueTokenPair({
      userId: user.id,
      role: user.role,
    });

    const refreshTokenHash = hashToken(tokenPair.refreshToken);
    const meta = extractRequestMeta(request);

    await Promise.all([
      this.refreshTokenRepository.create({
        tokenHash: refreshTokenHash,
        userId: user.id,
        expiresAt: tokenPair.refreshExpiresAt,
        userAgent: meta.userAgent,
        ipAddress: meta.ipAddress,
      }),
      this.usersRepository.updateLastLoginAt(user.id, new Date()),
    ]);

    return {
      accessToken: tokenPair.accessToken,
      refreshToken: tokenPair.refreshToken,
      user: toUserResponse(user),
    };
  }

  async refresh(dto: RefreshDto, request: Request) {
    const payload = await this.tokenService.verifyRefreshToken(
      dto.refreshToken,
    );
    const refreshTokenHash = hashToken(dto.refreshToken);
    const storedToken =
      await this.refreshTokenRepository.findActiveByHash(refreshTokenHash);

    if (!storedToken || storedToken.userId !== payload.sub) {
      throw new UnauthorizedException('Refresh token is invalid or revoked');
    }

    const revokedCount = await this.refreshTokenRepository.revokeById(
      storedToken.id,
    );
    if (revokedCount !== 1) {
      throw new UnauthorizedException('Refresh token is invalid or revoked');
    }

    const user = await this.usersRepository.findById(payload.sub);
    if (!user || !user.isActive) {
      throw new UnauthorizedException('User is not active');
    }

    const tokenPair = await this.tokenService.issueTokenPair({
      userId: user.id,
      role: user.role,
    });
    const meta = extractRequestMeta(request);

    await this.refreshTokenRepository.create({
      tokenHash: hashToken(tokenPair.refreshToken),
      userId: user.id,
      expiresAt: tokenPair.refreshExpiresAt,
      userAgent: meta.userAgent,
      ipAddress: meta.ipAddress,
    });

    return {
      accessToken: tokenPair.accessToken,
      refreshToken: tokenPair.refreshToken,
      user: toUserResponse(user),
    };
  }

  async logout(dto: LogoutDto) {
    await this.refreshTokenRepository.revokeByHash(hashToken(dto.refreshToken));

    return { success: true };
  }

  async me(authUser: AuthUser) {
    const user = await this.usersRepository.findById(authUser.id);
    if (!user || !user.isActive) {
      throw new UnauthorizedException('User is not active');
    }

    return { user: toUserResponse(user) };
  }

  private resolveBcryptRounds(): number {
    const raw = process.env.BCRYPT_SALT_ROUNDS;
    if (!raw) {
      return DEFAULT_BCRYPT_ROUNDS;
    }

    const parsed = Number(raw);
    if (!Number.isFinite(parsed) || parsed < 8 || parsed > 16) {
      throw new Error('BCRYPT_SALT_ROUNDS must be between 8 and 16');
    }

    return Math.floor(parsed);
  }
}
