import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { unlink } from 'fs/promises';
import { join, normalize, relative } from 'path';
import { AuthUser } from '../../common/types/auth-user.type';
import { toUserResponse } from '../../common/utils/user-response.util';
import { OrdersRepository } from '../../orders/repositories/orders.repository';
import { PrismaService } from '../../prisma/prisma.service';
import { UsersRepository } from '../../users/repositories/users.repository';

@Injectable()
export class UploadsService {
  constructor(
    private readonly usersRepository: UsersRepository,
    private readonly ordersRepository: OrdersRepository,
    private readonly prisma: PrismaService,
  ) {}

  async attachAvatar(authUser: AuthUser, fileUrl: string) {
    const currentUser = await this.usersRepository.findById(authUser.id);
    if (!currentUser || !currentUser.isActive) {
      throw new NotFoundException('User not found');
    }

    await this.deleteLocalUpload(currentUser.avatarUrl);

    const user = await this.usersRepository.update(authUser.id, {
      avatarUrl: fileUrl,
    });

    return {
      url: fileUrl,
      user: toUserResponse(user),
    };
  }

  async attachCargoPhoto(authUser: AuthUser, orderId: string, fileUrl: string) {
    const order = await this.findOwnedOrderOrThrow(authUser, orderId);

    await this.deleteLocalUpload(order.cargoPhotoUrl);

    const updatedOrder = await this.prisma.order.update({
      where: { id: orderId },
      data: {
        cargoPhotoUrl: fileUrl,
      },
    });

    return {
      url: fileUrl,
      order: updatedOrder,
    };
  }

  async attachProductPhoto(
    authUser: AuthUser,
    orderId: string,
    fileUrl: string,
  ) {
    const order = await this.findOwnedOrderOrThrow(authUser, orderId);

    const updatedOrder = await this.prisma.order.update({
      where: { id: orderId },
      data: {
        productPhotoUrls: [...order.productPhotoUrls, fileUrl],
      },
    });

    return {
      url: fileUrl,
      order: updatedOrder,
    };
  }

  private async findOwnedOrderOrThrow(authUser: AuthUser, orderId: string) {
    const order = await this.ordersRepository.findById(orderId);
    if (!order) {
      throw new NotFoundException('Order not found');
    }

    if (
      authUser.role === UserRole.SUPERADMIN ||
      order.clientId === authUser.id
    ) {
      return order;
    }

    throw new ForbiddenException('Order is not available for this user');
  }

  private async deleteLocalUpload(url: string | null) {
    if (!url) {
      return;
    }

    const uploadsIndex = url.indexOf('/uploads/');
    if (uploadsIndex === -1) {
      return;
    }

    const relativePath = url.slice(uploadsIndex + '/uploads/'.length);
    const uploadsRoot = normalize(join(process.cwd(), 'uploads'));
    const absolutePath = normalize(join(uploadsRoot, relativePath));

    if (relative(uploadsRoot, absolutePath).startsWith('..')) {
      return;
    }

    try {
      await unlink(absolutePath);
    } catch {
      return;
    }
  }
}
