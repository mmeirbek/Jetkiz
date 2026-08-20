import {
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { Order, OrderStatus, Route, UserRole } from '@prisma/client';
import { AuthUser } from '../../common/types/auth-user.type';
import { TrackingService } from '../../tracking/services/tracking.service';
import { CarrierProfileRepository } from '../../carrier/repositories/carrier-profile.repository';
import { CreateOrderDto } from '../dto/create-order.dto';
import { UpdateOrderDto } from '../dto/update-order.dto';
import { UpdateOrderStatusDto } from '../dto/update-order-status.dto';
import { OrdersRepository } from '../repositories/orders.repository';
import { RealtimeService } from '../../realtime/realtime.service';
import { isMangystauRoute } from '../../geo/mangystau';
import { SettlementsService } from '../../settlements/services/settlements.service';
import { RoutesService } from '../../routes/services/routes.service';

@Injectable()
export class OrdersService {
  private readonly logger = new Logger(OrdersService.name);

  constructor(
    private readonly ordersRepository: OrdersRepository,
    private readonly carrierProfileRepository: CarrierProfileRepository,
    private readonly trackingService: TrackingService,
    private readonly settlementsService: SettlementsService,
    private readonly routesService: RoutesService,
    private readonly realtimeService?: RealtimeService,
  ) {}

  async create(authUser: AuthUser, dto: CreateOrderDto) {
    if (authUser.role === UserRole.ADMIN) {
      throw new ForbiddenException('ADMIN users cannot create orders');
    }

    const { originSettlement, destinationSettlement } =
      await this.resolveSettlements(dto);

    const originLat = originSettlement?.latitude ?? dto.originLat!;
    const originLng = originSettlement?.longitude ?? dto.originLng!;
    const destinationLat =
      destinationSettlement?.latitude ?? dto.destinationLat!;
    const destinationLng =
      destinationSettlement?.longitude ?? dto.destinationLng!;

    this.ensureMangystauRoute(
      originLat,
      originLng,
      destinationLat,
      destinationLng,
    );

    const order = await this.ordersRepository.create({
      clientId: authUser.id,
      title: dto.title,
      cargoType: dto.cargoType,
      weight: dto.weight,
      volume: dto.volume,
      origin: originSettlement?.name ?? dto.origin!,
      originSettlementId: originSettlement?.id,
      originCity: originSettlement?.name ?? dto.originCity ?? null,
      originCountry: originSettlement
        ? 'Kazakhstan'
        : (dto.originCountry ?? null),
      destination: destinationSettlement?.name ?? dto.destination!,
      destinationSettlementId: destinationSettlement?.id,
      destinationCity:
        destinationSettlement?.name ?? dto.destinationCity ?? null,
      destinationCountry: destinationSettlement
        ? 'Kazakhstan'
        : (dto.destinationCountry ?? null),
      originLat,
      originLng,
      destinationLat,
      destinationLng,
      cargoPhotoUrl: dto.cargoPhotoUrl ?? null,
      productPhotoUrls: dto.productPhotoUrls ?? [],
      comment: dto.comment ?? null,
      estimatedPrice: dto.estimatedPrice ?? null,
      estimatedDeliveryTime: dto.estimatedDeliveryTime ?? null,
      estimatedCarrierSearchTime: dto.estimatedCarrierSearchTime ?? null,
      status: OrderStatus.SEARCHING,
    });

    await this.trackingService.recordOrderEvent({
      orderId: order.id,
      status: OrderStatus.SEARCHING,
      location: order.origin,
    });

    this.realtimeService?.emitOrderAvailable(order);

    const route = await this.tryCalculateRoute(order);
    const orderWithRouteEta = route
      ? await this.ordersRepository.update(order.id, {
          estimatedDeliveryTime: Math.max(
            1,
            Math.ceil(route.durationMinutes / 60),
          ),
        })
      : order;

    return {
      order: orderWithRouteEta,
      route,
      routeCalculated: route !== null,
    };
  }

  async listMine(authUser: AuthUser) {
    const orders = await this.ordersRepository.findManyForUser(authUser.id);
    return { orders };
  }

  async listAvailable() {
    const orders = await this.ordersRepository.findAvailable();
    return { orders };
  }

  async getById(authUser: AuthUser, orderId: string) {
    const order = await this.findVisibleOrderOrThrow(authUser, orderId);
    return { order };
  }

  async update(authUser: AuthUser, orderId: string, dto: UpdateOrderDto) {
    const order = await this.findVisibleOrderOrThrow(authUser, orderId);
    this.ensureClientOwnerOrSuperadmin(authUser, order);

    const { originSettlement, destinationSettlement } =
      await this.resolveSettlements(dto);

    this.ensureMangystauRoute(
      originSettlement?.latitude ?? dto.originLat ?? order.originLat,
      originSettlement?.longitude ?? dto.originLng ?? order.originLng,
      destinationSettlement?.latitude ??
        dto.destinationLat ??
        order.destinationLat,
      destinationSettlement?.longitude ??
        dto.destinationLng ??
        order.destinationLng,
    );

    if (
      authUser.role !== UserRole.SUPERADMIN &&
      !this.isEditableStatus(order.status)
    ) {
      throw new ConflictException(
        'Only searching or newly created orders can be edited',
      );
    }

    const updatedOrder = await this.ordersRepository.update(orderId, {
      title: dto.title,
      cargoType: dto.cargoType,
      weight: dto.weight,
      volume: dto.volume,
      origin: originSettlement?.name ?? dto.origin ?? undefined,
      originSettlement: originSettlement
        ? { connect: { id: originSettlement.id } }
        : undefined,
      originCity: originSettlement?.name ?? dto.originCity ?? undefined,
      originCountry: originSettlement
        ? 'Kazakhstan'
        : (dto.originCountry ?? undefined),
      destination: destinationSettlement?.name ?? dto.destination ?? undefined,
      destinationSettlement: destinationSettlement
        ? { connect: { id: destinationSettlement.id } }
        : undefined,
      destinationCity:
        destinationSettlement?.name ?? dto.destinationCity ?? undefined,
      destinationCountry: destinationSettlement
        ? 'Kazakhstan'
        : (dto.destinationCountry ?? undefined),
      originLat: originSettlement?.latitude ?? dto.originLat ?? undefined,
      originLng: originSettlement?.longitude ?? dto.originLng ?? undefined,
      destinationLat:
        destinationSettlement?.latitude ?? dto.destinationLat ?? undefined,
      destinationLng:
        destinationSettlement?.longitude ?? dto.destinationLng ?? undefined,
      cargoPhotoUrl: dto.cargoPhotoUrl,
      productPhotoUrls: dto.productPhotoUrls,
      comment: dto.comment,
      estimatedPrice: dto.estimatedPrice,
      estimatedDeliveryTime: dto.estimatedDeliveryTime,
      estimatedCarrierSearchTime: dto.estimatedCarrierSearchTime,
    });

    return { order: updatedOrder };
  }

  async updateStatus(
    authUser: AuthUser,
    orderId: string,
    dto: UpdateOrderStatusDto,
  ) {
    const order = await this.findVisibleOrderOrThrow(authUser, orderId);

    if (authUser.role === UserRole.SUPERADMIN) {
      const updatedOrder = await this.ordersRepository.update(orderId, {
        status: dto.status,
      });
      this.realtimeService?.emitOrderStatus(updatedOrder);
      await this.trackingService.recordOrderEvent({
        orderId,
        status: dto.status,
        location: this.resolveStatusLocation(updatedOrder),
      });

      return {
        order: updatedOrder,
      };
    }

    if (order.clientId === authUser.id) {
      if (dto.status !== OrderStatus.CANCELLED) {
        throw new ForbiddenException('Client can only cancel an order');
      }

      const updatedOrder = await this.ordersRepository.update(orderId, {
        status: dto.status,
      });
      this.realtimeService?.emitOrderStatus(updatedOrder);
      await this.trackingService.recordOrderEvent({
        orderId,
        status: dto.status,
        location: this.resolveStatusLocation(updatedOrder),
      });

      return {
        order: updatedOrder,
      };
    }

    if (await this.isAssignedCarrier(authUser.id, order)) {
      if (!this.isCarrierProgressStatus(dto.status)) {
        throw new ForbiddenException(
          'Carrier can only move assigned orders in transit or delivered',
        );
      }

      const updatedOrder = await this.ordersRepository.update(orderId, {
        status: dto.status,
      });
      this.realtimeService?.emitOrderStatus(updatedOrder);
      await this.trackingService.recordOrderEvent({
        orderId,
        status: dto.status,
        location: this.resolveStatusLocation(updatedOrder),
      });

      return {
        order: updatedOrder,
      };
    }

    throw new ForbiddenException('Order is not available for this user');
  }

  async delete(authUser: AuthUser, orderId: string) {
    const order = await this.findVisibleOrderOrThrow(authUser, orderId);
    this.ensureClientOwnerOrSuperadmin(authUser, order);

    if (
      authUser.role !== UserRole.SUPERADMIN &&
      this.isCarrierProgressStatus(order.status)
    ) {
      throw new ConflictException(
        'Active or delivered orders cannot be deleted',
      );
    }

    const deletedOrder = await this.ordersRepository.delete(orderId);
    return { order: deletedOrder };
  }

  private async findVisibleOrderOrThrow(authUser: AuthUser, orderId: string) {
    const order = await this.ordersRepository.findById(orderId);
    if (!order) {
      throw new NotFoundException('Order not found');
    }

    if (authUser.role === UserRole.SUPERADMIN) {
      return order;
    }

    if (
      order.clientId === authUser.id ||
      (await this.isAssignedCarrier(authUser.id, order))
    ) {
      return order;
    }

    throw new NotFoundException('Order not found');
  }

  private ensureClientOwnerOrSuperadmin(authUser: AuthUser, order: Order) {
    if (
      authUser.role === UserRole.SUPERADMIN ||
      order.clientId === authUser.id
    ) {
      return;
    }

    throw new ForbiddenException('Order is not available for this user');
  }

  private async isAssignedCarrier(userId: string, order: Order) {
    if (!order.carrierId) {
      return false;
    }

    const carrierProfile =
      await this.carrierProfileRepository.findByUserId(userId);
    return carrierProfile?.id === order.carrierId;
  }

  private isEditableStatus(status: OrderStatus) {
    return status === OrderStatus.NEW || status === OrderStatus.SEARCHING;
  }

  private isCarrierProgressStatus(status: OrderStatus) {
    return (
      status === OrderStatus.IN_TRANSIT || status === OrderStatus.DELIVERED
    );
  }

  private resolveStatusLocation(
    order: Pick<Order, 'origin' | 'destination' | 'status'>,
  ) {
    if (
      order.status === OrderStatus.NEW ||
      order.status === OrderStatus.SEARCHING ||
      order.status === OrderStatus.ASSIGNED
    ) {
      return order.origin;
    }

    if (order.status === OrderStatus.DELIVERED) {
      return order.destination;
    }

    return null;
  }

  private ensureMangystauRoute(
    originLat: number | null | undefined,
    originLng: number | null | undefined,
    destinationLat: number | null | undefined,
    destinationLng: number | null | undefined,
  ) {
    if (
      originLat == null ||
      originLng == null ||
      destinationLat == null ||
      destinationLng == null ||
      !isMangystauRoute(originLat, originLng, destinationLat, destinationLng)
    ) {
      throw new BadRequestException(
        'Origin and destination must be inside Mangystau Region',
      );
    }
  }

  private async resolveSettlements(
    dto: Pick<CreateOrderDto, 'originSettlementId' | 'destinationSettlementId'>,
  ) {
    const [originSettlement, destinationSettlement] = await Promise.all([
      dto.originSettlementId
        ? this.settlementsService
            .findOne(dto.originSettlementId)
            .then(({ settlement }) => settlement)
        : Promise.resolve(null),
      dto.destinationSettlementId
        ? this.settlementsService
            .findOne(dto.destinationSettlementId)
            .then(({ settlement }) => settlement)
        : Promise.resolve(null),
    ]);

    return { originSettlement, destinationSettlement };
  }

  private async tryCalculateRoute(order: Order): Promise<Route | null> {
    try {
      return await this.routesService.calculateForOrder(order);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn(
        `Route calculation failed for order ${order.id}: ${message}`,
      );
      return null;
    }
  }
}
