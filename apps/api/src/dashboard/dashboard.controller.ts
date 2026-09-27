import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { AuthenticatedUser } from '../auth/auth.types';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { UserRole } from '@prisma/client';
import { DashboardService } from './dashboard.service';

@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
@ApiTags('dashboard')
@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboard: DashboardService) {}
  @Get('summary') summary(@CurrentUser() actor: AuthenticatedUser) { return this.dashboard.summary(actor); }
  @Get('challenge') @Roles(UserRole.DEALERSHIP_AGENT, UserRole.DEALERSHIP_MANAGER, UserRole.FORD_ADMIN)
  challenge(@CurrentUser() actor: AuthenticatedUser, @Query() query: Record<string, string | undefined>) {
    return this.dashboard.challenge(actor, query);
  }
  @Get('repurchase') @Roles(UserRole.DEALERSHIP_AGENT, UserRole.DEALERSHIP_MANAGER, UserRole.FORD_ADMIN) repurchase(@CurrentUser() actor: AuthenticatedUser) { return this.dashboard.repurchase(actor); }
  @Get('admin') @Roles(UserRole.FORD_ADMIN) admin() { return this.dashboard.admin(); }
}
