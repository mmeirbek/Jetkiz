import { HttpModule } from '@nestjs/axios';
import { Module } from '@nestjs/common';
import { OpenWeatherService } from '../predictions/services/open-weather.service';
import { RoutePointResolverService } from '../predictions/services/route-point-resolver.service';
import { RoutesModule } from '../routes/routes.module';
import { RouteConditionsController } from './controllers/route-conditions.controller';
import { RouteConditionsService } from './services/route-conditions.service';

@Module({
  imports: [HttpModule, RoutesModule],
  controllers: [RouteConditionsController],
  providers: [
    RouteConditionsService,
    OpenWeatherService,
    RoutePointResolverService,
  ],
})
export class RouteConditionsModule {}
