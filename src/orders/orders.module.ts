import { Module } from '@nestjs/common';
import { CarrierModule } from '../carrier/carrier.module';
import { TrackingModule } from '../tracking/tracking.module';
import { RealtimeModule } from '../realtime/realtime.module';
import { OrdersController } from './controllers/orders.controller';
import { OrdersRepository } from './repositories/orders.repository';
import { OrderAssignmentService } from './services/order-assignment.service';
import { OrdersService } from './services/orders.service';

@Module({
  imports: [CarrierModule, TrackingModule, RealtimeModule],
  controllers: [OrdersController],
  providers: [OrdersService, OrderAssignmentService, OrdersRepository],
  exports: [OrdersRepository],
})
export class OrdersModule {}
