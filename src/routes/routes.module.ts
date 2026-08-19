import { HttpModule } from '@nestjs/axios';
import { Module } from '@nestjs/common';
import { CarrierModule } from '../carrier/carrier.module';
import { RoutesController } from './controllers/routes.controller';
import { RoutesRepository } from './repositories/routes.repository';
import { RoutesService } from './services/routes.service';
import { VroomService } from './services/vroom.service';

@Module({
  imports: [HttpModule, CarrierModule],
  controllers: [RoutesController],
  providers: [RoutesService, RoutesRepository, VroomService],
  exports: [RoutesService],
})
export class RoutesModule {}
