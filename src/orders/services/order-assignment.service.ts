import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { OrderStatus, UserRole } from '@prisma/client';
import { CarrierProfileRepository } from '../../carrier/repositories/carrier-profile.repository';
import { AuthUser } from '../../common/types/auth-user.type';
import { PrismaService } from '../../prisma/prisma.service';
import { TrackingService } from '../../tracking/services/tracking.service';
import { OrdersRepository } from '../repositories/orders.repository';
import { RealtimeService } from '../../realtime/realtime.service';

@Injectable()
export class OrderAssignmentService {
  constructor(
    private readonly ordersRepository: OrdersRepository,
    private readonly carrierProfileRepository: CarrierProfileRepository,
    private readonly trackingService: TrackingService,
    private readonly prisma: PrismaService,
    private readonly realtimeService?: RealtimeService,
  ) {}

  async assignToCurrentCarrier(authUser: AuthUser, orderId: string) {
    if (
      authUser.role !== UserRole.CARRIER &&
      authUser.role !== UserRole.SUPERADMIN
    ) {
      throw new ForbiddenException('CARRIER role is required');
    }

    const carrierProfile = await this.carrierProfileRepository.findByUserId(
      authUser.id,
    );
    if (!carrierProfile) {
      throw new NotFoundException('Carrier profile not found');
    }

    if (!carrierProfile.isApproved) {
      throw new ForbiddenException('Carrier profile is not approved');
    }

    const order = await this.ordersRepository.findById(orderId);
    if (!order) {
      throw new NotFoundException('Order not found');
    }

    if (order.carrierId && order.carrierId !== carrierProfile.id) {
      throw new ConflictException('Order is already assigned');
    }

    if (!this.isAssignableStatus(order.status)) {
      throw new ConflictException('Order cannot be assigned in current status');
    }

    const capacity = await this.calculateCarrierCapacity(carrierProfile.id);

    if (!capacity.vehicle) {
      throw new ConflictException(
        'Carrier has no registered vehicle to carry the order',
      );
    }

    if (capacity.freeKg < order.weight || capacity.freeM3 < order.volume) {
      const orderTons = Number((order.weight / 1000).toFixed(3));
      throw new ConflictException(
        `Not enough free capacity on the vehicle: ${capacity.freeTons} t / ${capacity.freeM3} m³ free, order needs ${orderTons} t / ${order.volume} m³`,
      );
    }

    const updatedOrder = await this.ordersRepository.update(orderId, {
      carrier: { connect: { id: carrierProfile.id } },
      status: OrderStatus.ASSIGNED,
    });

    await this.trackingService.recordOrderEvent({
      orderId,
      status: OrderStatus.ASSIGNED,
      location: updatedOrder.origin,
    });

    this.realtimeService?.emitOrderStatus(updatedOrder);

    return {
      order: updatedOrder,
      capacityTons: capacity.capacityTons,
      freeCapacityTons: capacity.freeTons,
    };
  }

  private async calculateCarrierCapacity(carrierId: string) {
    const vehicles = await this.prisma.vehicle.findMany({
      where: { carrierId },
      orderBy: [{ lastSeenAt: 'desc' }, { createdAt: 'desc' }],
    });
    const vehicle = vehicles[0] ?? null;

    const activeOrders = await this.prisma.order.findMany({
      where: {
        carrierId,
        status: {
          in: [
            OrderStatus.ASSIGNED,
            OrderStatus.PICKED_UP,
            OrderStatus.IN_TRANSIT,
            OrderStatus.AT_CHECKPOINT,
          ],
        },
      },
      select: { weight: true, volume: true },
    });

    const usedKg = activeOrders.reduce(
      (sum, order) => sum + (order.weight ?? 0),
      0,
    );
    const usedM3 = activeOrders.reduce(
      (sum, order) => sum + (order.volume ?? 0),
      0,
    );
    const capacityTons = vehicle?.capacityTons ?? 0;
    const cargoVolume = vehicle?.cargoVolume ?? 0;
    const freeKg = vehicle ? Math.max(0, capacityTons * 1000 - usedKg) : 0;
    const freeM3 = vehicle ? Math.max(0, cargoVolume - usedM3) : 0;

    return {
      vehicle,
      capacityTons,
      freeTons: Number((freeKg / 1000).toFixed(3)),
      freeKg,
      freeM3,
    };
  }

  private isAssignableStatus(status: OrderStatus) {
    return status === OrderStatus.NEW || status === OrderStatus.SEARCHING;
  }
}
