import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { AuthenticatedUser } from '../auth/auth.types';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { ChurnFeaturesDto } from './dto/churn-features.dto';
import { PredictionsService } from './predictions.service';
import { ReviewRecommendationDto } from './dto/review-recommendation.dto';

@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
@ApiTags('predictions')
@Controller('predictions')
export class PredictionsController {
  constructor(private readonly predictions: PredictionsService) {}

  @Post('churn')
  @Roles(UserRole.DEALERSHIP_AGENT, UserRole.DEALERSHIP_MANAGER, UserRole.FORD_ADMIN)
  churn(@Body() input: ChurnFeaturesDto) {
    return this.predictions.churn(input);
  }

  @Get('vehicles/:vin/churn')
  churnForVehicle(
    @Param('vin') vin: string,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.predictions.churnForVehicle(vin, actor);
  }

  @Get('customers/churn')
  @Roles(UserRole.DEALERSHIP_AGENT, UserRole.DEALERSHIP_MANAGER, UserRole.FORD_ADMIN)
  churnForCustomers(@CurrentUser() actor: AuthenticatedUser) {
    return this.predictions.churnForCustomers(actor);
  }

  @Post('vehicles/:vin/review')
  @Roles(UserRole.DEALERSHIP_AGENT, UserRole.DEALERSHIP_MANAGER, UserRole.FORD_ADMIN)
  reviewRecommendation(
    @Param('vin') vin: string,
    @Body() input: ReviewRecommendationDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.predictions.reviewRecommendation(vin, input, actor);
  }
}
