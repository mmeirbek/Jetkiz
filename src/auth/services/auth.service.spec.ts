import {
  BadRequestException,
  ConflictException,
  UnauthorizedException,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';
import type { Request } from 'express';
import { AuthService } from './auth.service';
import { hashPassword, verifyPassword } from '../../common/utils/password.util';

jest.mock('../../common/utils/password.util', () => ({
  hashPassword: jest.fn(),
  verifyPassword: jest.fn(),
}));

describe('AuthService', () => {
  const usersRepositoryMock = {
    findByEmail: jest.fn(),
    findById: jest.fn(),
    create: jest.fn(),
    updateLastLoginAt: jest.fn(),
  };
  const refreshTokenRepositoryMock = {
    create: jest.fn(),
    findActiveByHash: jest.fn(),
    revokeById: jest.fn(),
    revokeByHash: jest.fn(),
  };
  const tokenServiceMock = {
    issueTokenPair: jest.fn(),
    verifyRefreshToken: jest.fn(),
  };

  const hashPasswordMock = hashPassword as jest.MockedFunction<
    typeof hashPassword
  >;
  const verifyPasswordMock = verifyPassword as jest.MockedFunction<
    typeof verifyPassword
  >;

  let service: AuthService;

  const baseUser = {
    id: 'user-1',
    email: 'client01@caspex.local',
    passwordHash: 'stored-hash',
    role: UserRole.CLIENT,
    firstName: 'Alibi',
    lastName: 'Samatov',
    phone: '+77017777777',
    avatarUrl: null,
    companyName: null,
    companyLogo: null,
    city: null,
    country: null,
    isActive: true,
    lastLoginAt: null,
    createdAt: new Date('2026-06-10T10:00:00.000Z'),
    updatedAt: new Date('2026-06-10T10:00:00.000Z'),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    service = new AuthService(
      usersRepositoryMock as never,
      refreshTokenRepositoryMock as never,
      tokenServiceMock as never,
    );
  });

  function buildRequest(): Request {
    return {
      ip: '10.0.0.1',
      get: (name: string) => {
        const key = name.toLowerCase();
        if (key === 'user-agent') {
          return 'jest-agent';
        }
        if (key === 'x-forwarded-for') {
          return '203.0.113.10';
        }
        return undefined;
      },
    } as unknown as Request;
  }

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('registers new user', async () => {
    usersRepositoryMock.findByEmail.mockResolvedValue(null);
    hashPasswordMock.mockResolvedValue('new-password-hash');
    usersRepositoryMock.create.mockResolvedValue({
      ...baseUser,
    });

    const result = await service.register(undefined, {
      email: 'client01@caspex.local',
      password: 'CaspXPass_123',
      role: UserRole.CLIENT,
      firstName: 'Alibi',
      lastName: 'Samatov',
      phone: '+77017777777',
    });

    expect(usersRepositoryMock.create).toHaveBeenCalledWith(
      expect.objectContaining({
        email: 'client01@caspex.local',
        passwordHash: 'new-password-hash',
        role: UserRole.CLIENT,
        firstName: 'Alibi',
        lastName: 'Samatov',
        phone: '+77017777777',
      }),
    );
    expect(result.user.email).toBe('client01@caspex.local');
  });

  it('rejects register when email already exists', async () => {
    usersRepositoryMock.findByEmail.mockResolvedValue(baseUser);

    await expect(
      service.register(undefined, {
        email: 'client01@caspex.local',
        password: 'CaspXPass_123',
        role: UserRole.CLIENT,
        firstName: 'Alibi',
        lastName: 'Samatov',
        phone: '+77017777777',
      }),
    ).rejects.toThrow(ConflictException);
  });

  it('rejects public admin registration', async () => {
    await expect(
      service.register(undefined, {
        email: 'admin01@caspex.local',
        password: 'CaspXPass_123',
        role: UserRole.ADMIN,
        firstName: 'Admin',
        lastName: 'User',
        phone: '+77017777777',
      }),
    ).rejects.toThrow(BadRequestException);

    expect(usersRepositoryMock.findByEmail).not.toHaveBeenCalled();
    expect(usersRepositoryMock.create).not.toHaveBeenCalled();
  });

  it('logs in user and stores refresh token metadata', async () => {
    usersRepositoryMock.findByEmail.mockResolvedValue(baseUser);
    verifyPasswordMock.mockResolvedValue(true);
    tokenServiceMock.issueTokenPair.mockResolvedValue({
      accessToken: 'access-token',
      refreshToken: 'refresh-token',
      accessExpiresAt: new Date('2026-06-10T11:00:00.000Z'),
      refreshExpiresAt: new Date('2026-06-17T10:00:00.000Z'),
    });
    refreshTokenRepositoryMock.create.mockResolvedValue({
      id: 'rt-1',
    });
    usersRepositoryMock.updateLastLoginAt.mockResolvedValue(baseUser);

    const result = await service.login(
      {
        email: baseUser.email,
        password: 'CaspXPass_123',
      },
      buildRequest(),
    );

    expect(tokenServiceMock.issueTokenPair).toHaveBeenCalledWith({
      userId: baseUser.id,
      role: baseUser.role,
    });
    expect(refreshTokenRepositoryMock.create).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: baseUser.id,
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment -- jest.any returns `any`
        tokenHash: expect.any(String),
        userAgent: 'jest-agent',
        ipAddress: '203.0.113.10',
      }),
    );
    expect(result.accessToken).toBe('access-token');
    expect(result.refreshToken).toBe('refresh-token');
    expect(result.user.email).toBe(baseUser.email);
  });

  it('rejects refresh when stored token is not found', async () => {
    tokenServiceMock.verifyRefreshToken.mockResolvedValue({
      sub: 'user-1',
      tokenType: 'refresh',
    });
    refreshTokenRepositoryMock.findActiveByHash.mockResolvedValue(null);

    await expect(
      service.refresh(
        {
          refreshToken: 'invalid-token',
        },
        buildRequest(),
      ),
    ).rejects.toThrow(UnauthorizedException);
  });
});
