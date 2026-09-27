import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { AuthenticatedUser } from '../auth/auth.types';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { CreateVoucherDto } from './dto/create-voucher.dto';
import { LoyaltyService } from './loyalty.service';

@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
@ApiTags('loyalty')
@Controller('loyalty')
export class LoyaltyController {
  constructor(private readonly loyalty: LoyaltyService) {}
  @Get('me') me(@CurrentUser() actor: AuthenticatedUser) { return this.loyalty.me(actor); }
  @Get('summary') @Roles(UserRole.DEALERSHIP_AGENT, UserRole.DEALERSHIP_MANAGER, UserRole.FORD_ADMIN) summary(@CurrentUser() actor: AuthenticatedUser) { return this.loyalty.summary(actor); }
  @Get(':userId') @Roles(UserRole.DEALERSHIP_AGENT, UserRole.DEALERSHIP_MANAGER, UserRole.FORD_ADMIN) account(@Param('userId') userId: string, @CurrentUser() actor: AuthenticatedUser) { return this.loyalty.account(userId, actor); }
  @Post('vouchers') @Roles(UserRole.DEALERSHIP_AGENT, UserRole.DEALERSHIP_MANAGER, UserRole.FORD_ADMIN) create(@Body() input: CreateVoucherDto, @CurrentUser() actor: AuthenticatedUser) { return this.loyalty.createVoucher(input, actor); }
  @Post('vouchers/:code/redeem') redeem(@Param('code') code: string, @CurrentUser() actor: AuthenticatedUser) { return this.loyalty.redeem(code, actor); }
}
