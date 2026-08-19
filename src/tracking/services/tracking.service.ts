import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Order, OrderStatus, UserRole } from '@prisma/client';
import { CarrierProfileRepository } from '../../carrier/repositories/carrier-profile.repository';
import { AuthUser } from '../../common/types/auth-user.type';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateOrderTrackingDto } from '../dto/create-order-tracking.dto';
import { OrderTrackingRepository } from '../repositories/order-tracking.repository';

@Injectable()
export class TrackingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly carrierProfileRepository: CarrierProfileRepository,
    private readonly orderTrackingRepository: OrderTrackingRepository,
  ) {}

  async createOrderTracking(
    authUser: AuthUser,
    orderId: string,
    dto: CreateOrderTrackingDto,
  ) {
    const order = await this.findVisibleOrderOrThrow(authUser, orderId);
    await this.ensureTrackingWriteAccess(authUser, order);
    this.ensureTransitionIsAllowed(order.status, dto.status);

    const updatedOrder = await this.prisma.order.update({
      where: { id: orderId },
      data: {
        status: dto.status,
      },
    });

    const tracking = await this.orderTrackingRepository.create({
      orderId,
      status: dto.status,
      location:
        dto.location ?? this.resolveDefaultLocation(updatedOrder, dto.status),
      timestamp: dto.timestamp ?? new Date(),
    });

    return { tracking };
  }

  async getOrderTracking(authUser: AuthUser, orderId: string) {
    const order = await this.findVisibleOrderOrThrow(authUser, orderId);
    const tracking = await this.orderTrackingRepository.findByOrderId(orderId);

    return {
      orderId: order.id,
      currentStatus: order.status,
      tracking,
    };
  }

  async recordOrderEvent(params: {
    orderId: string;
    status: OrderStatus;
    location?: string | null;
    timestamp?: Date;
  }) {
    const order = await this.prisma.order.findUnique({
      where: { id: params.orderId },
    });
    if (!order) {
      throw new NotFoundException('Order not found');
    }

    return this.orderTrackingRepository.create({
      orderId: params.orderId,
      status: params.status,
      location:
        params.location ?? this.resolveDefaultLocation(order, params.status),
      timestamp: params.timestamp ?? new Date(),
    });
  }

  private async findVisibleOrderOrThrow(authUser: AuthUser, orderId: string) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
    });
    if (!order) {
      throw new NotFoundException('Order not found');
    }

    if (authUser.role === UserRole.SUPERADMIN) {
      return order;
    }

    if (order.clientId === authUser.id) {
      return order;
    }

    if (await this.isAssignedCarrier(authUser.id, order)) {
      return order;
    }

    throw new NotFoundException('Order not found');
  }

  private async ensureTrackingWriteAccess(authUser: AuthUser, order: Order) {
    if (authUser.role === UserRole.SUPERADMIN) {
      return;
    }

    if (await this.isAssignedCarrier(authUser.id, order)) {
      return;
    }

    throw new ForbiddenException(
      'Only assigned carrier or SUPERADMIN can create tracking events',
    );
  }

  private async isAssignedCarrier(userId: string, order: Order) {
    if (!order.carrierId) {
      return false;
    }

    const carrierProfile =
      await this.carrierProfileRepository.findByUserId(userId);
    return carrierProfile?.id === order.carrierId;
  }

  private ensureTransitionIsAllowed(current: OrderStatus, next: OrderStatus) {
    if (
      current === OrderStatus.DELIVERED ||
      current === OrderStatus.CANCELLED
    ) {
      throw new ConflictException(
        'Tracking cannot be updated for closed orders',
      );
    }

    if (next === OrderStatus.CANCELLED) {
      return;
    }

    const statusRank: Record<OrderStatus, number> = {
      NEW: 0,
      SEARCHING: 1,
      ASSIGNED: 2,
      PICKED_UP: 3,
      IN_TRANSIT: 4,
      AT_CHECKPOINT: 5,
      DELIVERED: 6,
      CANCELLED: 7,
    };

    if (statusRank[next] < statusRank[current]) {
      throw new ConflictException('Tracking status cannot move backwards');
    }
  }

  private resolveDefaultLocation(
    order: Pick<Order, 'origin' | 'destination'>,
    status: OrderStatus,
  ) {
    if (
      status === OrderStatus.NEW ||
      status === OrderStatus.SEARCHING ||
      status === OrderStatus.ASSIGNED
    ) {
      return order.origin;
    }

    if (status === OrderStatus.DELIVERED) {
      return order.destination;
    }

    return null;
  }
}
