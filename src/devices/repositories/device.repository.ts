import { Injectable } from '@nestjs/common';
import { Device, DeviceStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class DeviceRepository {
  constructor(private readonly prisma: PrismaService) {}

  create(params: {
    name: string;
    secretHash: string;
    vehicleId?: string | null;
  }): Promise<Device> {
    return this.prisma.device.create({
      data: {
        name: params.name,
        secretHash: params.secretHash,
        vehicleId: params.vehicleId ?? null,
      },
    });
  }

  findById(id: string): Promise<Device | null> {
    return this.prisma.device.findUnique({ where: { id } });
  }

  findActiveById(id: string): Promise<Device | null> {
    return this.prisma.device.findFirst({
      where: { id, status: DeviceStatus.ACTIVE },
    });
  }

  findByIdWithVehicle(id: string): Promise<Device | null> {
    return this.prisma.device.findUnique({
      where: { id },
      include: { vehicle: true },
    });
  }

  findByVehicleId(vehicleId: string): Promise<Device | null> {
    return this.prisma.device.findUnique({ where: { vehicleId } });
  }

  findAll(): Promise<Device[]> {
    return this.prisma.device.findMany({ orderBy: { createdAt: 'desc' } });
  }

  findByCarrierProfile(carrierId: string): Promise<Device[]> {
    return this.prisma.device.findMany({
      where: { vehicle: { carrierId } },
      orderBy: { createdAt: 'desc' },
    });
  }

  update(id: string, data: Prisma.DeviceUncheckedUpdateInput): Promise<Device> {
    return this.prisma.device.update({ where: { id }, data });
  }

  delete(id: string): Promise<Device> {
    return this.prisma.device.delete({ where: { id } });
  }
}
