import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, UserRole } from '@prisma/client';
import { CarrierProfileRepository } from '../../carrier/repositories/carrier-profile.repository';
import type { AuthUser } from '../../common/types/auth-user.type';
import { PrismaService } from '../../prisma/prisma.service';
import { BindDeviceVehicleDto } from '../dto/bind-device-vehicle.dto';
import { CreateDeviceDto } from '../dto/create-device.dto';
import { DeviceRepository } from '../repositories/device.repository';
import { DeviceSecretService } from './device-secret.service';

@Injectable()
export class DevicesService {
  constructor(
    private readonly deviceRepository: DeviceRepository,
    private readonly deviceSecretService: DeviceSecretService,
    private readonly carrierProfileRepository: CarrierProfileRepository,
    private readonly prisma: PrismaService,
  ) {}

  async create(authUser: AuthUser, dto: CreateDeviceDto) {
    this.ensureRole(authUser);

    const vehicleId = dto.vehicleId
      ? await this.resolveOwnedVehicleId(authUser, dto.vehicleId)
      : null;

    const secret = this.deviceSecretService.generateSecret();
    const secretHash = await this.deviceSecretService.hashSecret(secret);

    try {
      const device = await this.deviceRepository.create({
        name: dto.name,
        secretHash,
        vehicleId,
      });
      return { device, secret };
    } catch (error) {
      this.mapVehicleAlreadyBoundError(error);
    }
  }

  async list(authUser: AuthUser) {
    if (authUser.role === UserRole.SUPERADMIN) {
      return { devices: await this.deviceRepository.findAll() };
    }

    if (authUser.role === UserRole.ADMIN) {
      return { devices: await this.deviceRepository.findAll() };
    }

    if (authUser.role === UserRole.CLIENT) {
      return { devices: await this.deviceRepository.findForClient(authUser.id) };
    }

    this.ensureRole(authUser);

    const carrierProfile = await this.carrierProfileRepository.findByUserId(
      authUser.id,
    );
    if (!carrierProfile) {
      return { devices: [] };
    }

    return {
      devices: await this.deviceRepository.findByCarrierProfile(
        carrierProfile.id,
      ),
    };
  }

  async bindVehicle(
    authUser: AuthUser,
    deviceId: string,
    dto: BindDeviceVehicleDto,
  ) {
    this.ensureRole(authUser);

    const device = await this.findOwnedDeviceOrThrow(authUser, deviceId);

    const vehicleId = dto.vehicleId
      ? await this.resolveOwnedVehicleId(authUser, dto.vehicleId)
      : null;

    try {
      const updated = await this.deviceRepository.update(device.id, {
        vehicleId,
      });
      return { device: updated };
    } catch (error) {
      this.mapVehicleAlreadyBoundError(error);
    }
  }

  async rotateSecret(authUser: AuthUser, deviceId: string) {
    this.ensureRole(authUser);

    const device = await this.findOwnedDeviceOrThrow(authUser, deviceId);

    const secret = this.deviceSecretService.generateSecret();
    const secretHash = await this.deviceSecretService.hashSecret(secret);
    const updated = await this.deviceRepository.update(device.id, {
      secretHash,
    });

    return { device: updated, secret };
  }

  async remove(authUser: AuthUser, deviceId: string) {
    this.ensureRole(authUser);

    const device = await this.findOwnedDeviceOrThrow(authUser, deviceId);
    const deleted = await this.deviceRepository.delete(device.id);

    return { device: deleted };
  }

  private ensureRole(authUser: AuthUser) {
    if (
      authUser.role !== UserRole.SUPERADMIN &&
      authUser.role !== UserRole.CARRIER
    ) {
      throw new ForbiddenException(
        'Only SUPERADMIN or CARRIER can manage devices',
      );
    }
  }

  private async findOwnedDeviceOrThrow(authUser: AuthUser, deviceId: string) {
    const device = await this.deviceRepository.findById(deviceId);
    if (!device) {
      throw new NotFoundException('Device not found');
    }

    if (authUser.role === UserRole.SUPERADMIN) {
      return device;
    }

    const carrierProfile = await this.carrierProfileRepository.findByUserId(
      authUser.id,
    );
    if (!carrierProfile) {
      throw new NotFoundException('Device not found');
    }

    if (device.vehicleId) {
      const vehicleCarrierId = await this.getVehicleCarrierId(device.vehicleId);
      if (vehicleCarrierId !== carrierProfile.id) {
        throw new NotFoundException('Device not found');
      }
    }

    return device;
  }

  private async getVehicleCarrierId(vehicleId: string): Promise<string | null> {
    const vehicle = await this.prisma.vehicle.findUnique({
      where: { id: vehicleId },
      select: { carrierId: true },
    });
    return vehicle?.carrierId ?? null;
  }

  private async resolveOwnedVehicleId(
    authUser: AuthUser,
    vehicleId: string,
  ): Promise<string> {
    if (authUser.role === UserRole.SUPERADMIN) {
      const vehicle = await this.prisma.vehicle.findUnique({
        where: { id: vehicleId },
        select: { id: true },
      });
      if (!vehicle) {
        throw new NotFoundException('Vehicle not found');
      }
      return vehicle.id;
    }

    const carrierProfile = await this.carrierProfileRepository.findByUserId(
      authUser.id,
    );
    if (!carrierProfile) {
      throw new NotFoundException('Carrier profile not found');
    }

    const vehicle = await this.prisma.vehicle.findFirst({
      where: { id: vehicleId, carrierId: carrierProfile.id },
      select: { id: true },
    });
    if (!vehicle) {
      throw new NotFoundException('Vehicle not found');
    }
    return vehicle.id;
  }

  private mapVehicleAlreadyBoundError(error: unknown): never {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      throw new ConflictException('Vehicle is already bound to another device');
    }
    throw error;
  }
}
