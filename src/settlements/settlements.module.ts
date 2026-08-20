import { Module } from '@nestjs/common';
import { SettlementsController } from './controllers/settlements.controller';
import { SettlementsService } from './services/settlements.service';

@Module({
  controllers: [SettlementsController],
  providers: [SettlementsService],
  exports: [SettlementsService],
})
export class SettlementsModule {}
