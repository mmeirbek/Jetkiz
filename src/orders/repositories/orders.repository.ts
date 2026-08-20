import { Injectable } from '@nestjs/common';
import { Order, OrderStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class OrdersRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(data: Prisma.OrderUncheckedCreateInput): Promise<Order> {
    return this.prisma.order.create({ data });
  }

  async findById(id: string): Promise<Order | null> {
    return this.prisma.order.findUnique({ where: { id } });
  }

  async findManyForUser(userId: string): Promise<Order[]> {
    return this.prisma.order.findMany({
      where: {
        OR: [{ clientId: userId }, { carrier: { userId } }],
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  findAll(): Promise<Order[]> {
    return this.prisma.order.findMany({ orderBy: { createdAt: 'desc' } });
  }

  async findAvailable(): Promise<Order[]> {
    return this.prisma.order.findMany({
      where: {
        carrierId: null,
        status: { in: [OrderStatus.NEW, OrderStatus.SEARCHING] },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findAvailableForCarrier(carrierId: string): Promise<Order[]> {
    const vehicle = await this.prisma.vehicle.findFirst({
      where: { carrierId },
      orderBy: [{ lastSeenAt: 'desc' }, { createdAt: 'desc' }],
    });

    if (!vehicle) return [];

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
    const freeKg = Math.max(0, vehicle.capacityTons * 1000 - usedKg);
    const freeM3 = Math.max(0, vehicle.cargoVolume - usedM3);

    const orders = await this.findAvailable();
    return orders.filter(
      (order) => order.weight <= freeKg && order.volume <= freeM3,
    );
  }

  async update(id: string, data: Prisma.OrderUpdateInput): Promise<Order> {
    return this.prisma.order.update({
      where: { id },
      data,
    });
  }

  async delete(id: string): Promise<Order> {
    return this.prisma.order.delete({ where: { id } });
  }
}
