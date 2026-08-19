import { Module } from '@nestjs/common';
import { CarrierModule } from '../carrier/carrier.module';
import { RealtimeModule } from '../realtime/realtime.module';
import { AlertsController } from './controllers/alerts.controller';
import { AlertsRepository } from './repositories/alerts.repository';
import { AlertsService } from './services/alerts.service';

@Module({
  imports: [CarrierModule, RealtimeModule],
  controllers: [AlertsController],
  providers: [AlertsService, AlertsRepository],
  exports: [AlertsService],
})
export class AlertsModule {}
