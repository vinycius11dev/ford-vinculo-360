import { Module } from '@nestjs/common';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';
import { PredictionsModule } from '../predictions/predictions.module';
@Module({ imports: [PredictionsModule], controllers: [DashboardController], providers: [DashboardService] })
export class DashboardModule {}
