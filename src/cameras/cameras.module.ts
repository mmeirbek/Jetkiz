import { Module } from '@nestjs/common';
import { DevicesModule } from '../devices/devices.module';
import { RealtimeModule } from '../realtime/realtime.module';
import { CamerasController } from './cameras.controller';
import { CamerasService } from './cameras.service';

@Module({
  imports: [DevicesModule, RealtimeModule],
  controllers: [CamerasController],
  providers: [CamerasService],
  exports: [CamerasService],
})
export class CamerasModule {}
