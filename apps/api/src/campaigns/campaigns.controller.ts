import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { AuthenticatedUser } from '../auth/auth.types';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { CampaignsService } from './campaigns.service';
import { CreateCampaignDto } from './dto/create-campaign.dto';

@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
@ApiTags('campaigns')
@Controller('campaigns')
export class CampaignsController {
  constructor(private readonly campaigns: CampaignsService) {}
  @Get('offers')
  @Roles(UserRole.CUSTOMER)
  offers(@CurrentUser() actor: AuthenticatedUser) {
    return this.campaigns.offers(actor);
  }

  @Get('segments')
  @Roles(
    UserRole.DEALERSHIP_AGENT,
    UserRole.DEALERSHIP_MANAGER,
    UserRole.FORD_ADMIN,
  )
  smartSegments(@CurrentUser() actor: AuthenticatedUser) {
    return this.campaigns.getSmartSegments(actor);
  }

  @Get()
  @Roles(
    UserRole.DEALERSHIP_AGENT,
    UserRole.DEALERSHIP_MANAGER,
    UserRole.FORD_ADMIN,
  )
  list(@CurrentUser() actor: AuthenticatedUser) {
    return this.campaigns.list(actor);
  }

  @Post()
  @Roles(
    UserRole.DEALERSHIP_AGENT,
    UserRole.DEALERSHIP_MANAGER,
    UserRole.FORD_ADMIN,
  )
  create(
    @Body() input: CreateCampaignDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.campaigns.create(input, actor);
  }

  @Post(':id/dispatch')
  @Roles(
    UserRole.DEALERSHIP_AGENT,
    UserRole.DEALERSHIP_MANAGER,
    UserRole.FORD_ADMIN,
  )
  dispatch(
    @Param('id') id: string,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.campaigns.dispatch(id, actor);
  }
}
