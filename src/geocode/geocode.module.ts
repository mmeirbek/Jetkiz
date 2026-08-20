import { HttpModule } from '@nestjs/axios';
import { Module } from '@nestjs/common';
import { GeocodeController } from './geocode.controller';
import { GeocodeService } from './geocode.service';

@Module({
  imports: [HttpModule],
  controllers: [GeocodeController],
  providers: [GeocodeService],
})
export class GeocodeModule {}