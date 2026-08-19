import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { OrderStatus, UserRole } from '@prisma/client';
import { CarrierProfileRepository } from '../../carrier/repositories/carrier-profile.repository';
import { AuthUser } from '../../common/types/auth-user.type';
import { TrackingService } from '../../tracking/services/tracking.service';
import { OrdersRepository } from '../repositories/orders.repository';
import { RealtimeService } from '../../realtime/realtime.service';

@Injectable()
export class OrderAssignmentService {
  constructor(
    private readonly ordersRepository: OrdersRepository,
    private readonly carrierProfileRepository: CarrierProfileRepository,
    private readonly trackingService: TrackingService,
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

    return { order: updatedOrder };
  }

  private isAssignableStatus(status: OrderStatus) {
    return status === OrderStatus.NEW || status === OrderStatus.SEARCHING;
  }
}
