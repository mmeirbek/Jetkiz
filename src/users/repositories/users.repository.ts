import { Injectable } from '@nestjs/common';
import { Prisma, User, UserRole } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class UsersRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string): Promise<User | null> {
    return this.prisma.user.findUnique({
      where: { id },
    });
  }

  async findByEmail(email: string): Promise<User | null> {
    return this.prisma.user.findUnique({
      where: { email },
    });
  }

  async create(params: {
    email: string;
    passwordHash: string;
    role: UserRole;
    firstName: string;
    lastName: string;
    phone: string;
    avatarUrl?: string | null;
    companyName?: string | null;
    companyLogo?: string | null;
    city?: string | null;
    country?: string | null;
    personalDataConsentAt?: Date | null;
    privacyPolicyConsentAt?: Date | null;
  }): Promise<User> {
    return this.prisma.user.create({
      data: params,
    });
  }

  async createCarrierProfile(userId: string) {
    return this.prisma.carrierProfile.create({
      data: {
        userId,
        experienceYears: 0,
        transportType: 'ROAD',
        description: null,
        isApproved: false,
      },
    });
  }

  async findMany(params: {
    skip: number;
    take: number;
    role?: UserRole;
    isActive?: boolean;
    search?: string;
  }): Promise<User[]> {
    return this.prisma.user.findMany({
      where: this.buildWhere(params),
      orderBy: { createdAt: 'desc' },
      skip: params.skip,
      take: params.take,
    });
  }

  async count(params: {
    role?: UserRole;
    isActive?: boolean;
    search?: string;
  }): Promise<number> {
    return this.prisma.user.count({
      where: this.buildWhere(params),
    });
  }

  async updateLastLoginAt(userId: string, at: Date): Promise<User> {
    return this.prisma.user.update({
      where: { id: userId },
      data: { lastLoginAt: at },
    });
  }

  async update(
    userId: string,
    data: Partial<Omit<User, 'id' | 'createdAt' | 'updatedAt'>>,
  ): Promise<User> {
    return this.prisma.user.update({
      where: { id: userId },
      data,
    });
  }

  private buildWhere(params: {
    role?: UserRole;
    isActive?: boolean;
    search?: string;
  }): Prisma.UserWhereInput {
    const search = params.search?.trim();

    return {
      role: params.role,
      isActive: params.isActive,
      ...(search
        ? {
            OR: [
              { email: { contains: search, mode: 'insensitive' } },
              { firstName: { contains: search, mode: 'insensitive' } },
              { lastName: { contains: search, mode: 'insensitive' } },
              { phone: { contains: search, mode: 'insensitive' } },
              { companyName: { contains: search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };
  }
}
