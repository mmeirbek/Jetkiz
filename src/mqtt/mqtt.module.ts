import { Module } from '@nestjs/common';
import { DevicesModule } from '../devices/devices.module';
import { RealtimeModule } from '../realtime/realtime.module';
import { TelemetryModule } from '../telemetry/telemetry.module';
import { MqttClientService } from './services/mqtt-client.service';
import { TelemetryConsumerService } from './services/telemetry-consumer.service';

@Module({
  imports: [DevicesModule, TelemetryModule, RealtimeModule],
  providers: [MqttClientService, TelemetryConsumerService],
  exports: [MqttClientService],
})
export class MqttModule {}
