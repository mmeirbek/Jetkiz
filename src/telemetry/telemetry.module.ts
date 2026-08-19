import { Module } from '@nestjs/common';
import { CarrierModule } from '../carrier/carrier.module';
import { TelemetryController } from './controllers/telemetry.controller';
import { TelemetryRepository } from './repositories/telemetry.repository';
import { TelemetryService } from './services/telemetry.service';

@Module({
  imports: [CarrierModule],
  controllers: [TelemetryController],
  providers: [TelemetryService, TelemetryRepository],
  exports: [TelemetryRepository],
})
export class TelemetryModule {}
