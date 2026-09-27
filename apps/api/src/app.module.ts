import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { APP_GUARD } from "@nestjs/core";
import { ThrottlerGuard, ThrottlerModule } from "@nestjs/throttler";
import { HealthController } from "./health.controller";
import { PrismaModule } from "./prisma/prisma.module";
import { VehiclesModule } from "./vehicles/vehicles.module";
import { AuthModule } from "./auth/auth.module";
import { DealershipsModule } from "./dealerships/dealerships.module";
import { UsersModule } from "./users/users.module";
import { OwnershipsModule } from "./ownerships/ownerships.module";
import { ServiceOrdersModule } from "./service-orders/service-orders.module";
import { BookingsModule } from "./bookings/bookings.module";
import { LoyaltyModule } from "./loyalty/loyalty.module";
import { CampaignsModule } from "./campaigns/campaigns.module";
import { DashboardModule } from "./dashboard/dashboard.module";
import { PredictionsModule } from "./predictions/predictions.module";
import { RepurchaseLeadsModule } from "./repurchase-leads/repurchase-leads.module";
import { AuditModule } from "./audit/audit.module";
import { NotificationsModule } from "./notifications/notifications.module";
import { RecallsModule } from "./recalls/recalls.module";
import { PrivacyModule } from "./privacy/privacy.module";
import { SupportModule } from "./support/support.module";
import { MessagingModule } from "./messaging/messaging.module";
import { SalesModule } from "./sales/sales.module";
import { SettingsController } from './settings/settings.controller';
import { PilotImportModule } from './pilot-import/pilot-import.module';
import { CatalogModule } from './catalog/catalog.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 120 }]),
    PrismaModule,
    AuthModule,
    DealershipsModule,
    UsersModule,
    VehiclesModule,
    OwnershipsModule,
    ServiceOrdersModule,
    BookingsModule,
    LoyaltyModule,
    CampaignsModule,
    DashboardModule,
    PredictionsModule,
    RepurchaseLeadsModule,
    AuditModule,
    NotificationsModule,
    RecallsModule,
    PrivacyModule,
    SupportModule,
    MessagingModule,
    SalesModule,
    PilotImportModule,
    CatalogModule,
  ],
  controllers: [HealthController, SettingsController],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
})
export class AppModule {}
