import { Module } from '@nestjs/common';
import { CarrierModule } from '../carrier/carrier.module';
import { DevicesController } from './controllers/devices.controller';
import { DeviceRepository } from './repositories/device.repository';
import { DeviceSecretService } from './services/device-secret.service';
import { DevicesService } from './services/devices.service';

@Module({
  imports: [CarrierModule],
  controllers: [DevicesController],
  providers: [DevicesService, DeviceRepository, DeviceSecretService],
  exports: [DeviceRepository, DeviceSecretService],
})
export class DevicesModule {}
