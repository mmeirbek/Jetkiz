import 'dotenv/config';
import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { CarrierModule } from './carrier/carrier.module';
import { UsersModule } from './users/users.module';
import { OrdersModule } from './orders/orders.module';
import { PrismaModule } from './prisma/prisma.module';
import { SuperadminModule } from './superadmin/superadmin.module';
import { TrackingModule } from './tracking/tracking.module';
import { VehiclesModule } from './vehicles/vehicles.module';
import { RoutesModule } from './routes/routes.module';
import { UploadsModule } from './uploads/uploads.module';
import { CheckpointLoadsModule } from './checkpoint-loads/checkpoint-loads.module';
import { PredictionsModule } from './predictions/predictions.module';
import { DevicesModule } from './devices/devices.module';
import { TelemetryModule } from './telemetry/telemetry.module';
import { MqttModule } from './mqtt/mqtt.module';
import { RealtimeModule } from './realtime/realtime.module';
import { AlertsModule } from './alerts/alerts.module';
import { CamerasModule } from './cameras/cameras.module';
import { AnalyticsModule } from './analytics/analytics.module';
import { RouteConditionsModule } from './route-conditions/route-conditions.module';
import { SettlementsModule } from './settlements/settlements.module';

@Module({
  imports: [
    PrismaModule,
    AuthModule,
    CarrierModule,
    UsersModule,
    OrdersModule,
    SuperadminModule,
    TrackingModule,
    VehiclesModule,
    RoutesModule,
    UploadsModule,
    CheckpointLoadsModule,
    PredictionsModule,
    DevicesModule,
    TelemetryModule,
    MqttModule,
    RealtimeModule,
    AlertsModule,
    CamerasModule,
    AnalyticsModule,
    RouteConditionsModule,
    SettlementsModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
