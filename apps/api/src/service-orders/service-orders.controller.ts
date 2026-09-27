import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { AuthenticatedUser } from '../auth/auth.types';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { CreateServiceOrderDto } from './dto/create-service-order.dto';
import { UpdateServiceOrderDto } from './dto/update-service-order.dto';
import { ServiceOrdersService } from './service-orders.service';

@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
@ApiTags('service-orders')
@Controller('service-orders')
export class ServiceOrdersController {
  constructor(private readonly orders: ServiceOrdersService) {}
  @Get() list(@CurrentUser() actor: AuthenticatedUser) { return this.orders.list(actor); }
  @Post() @Roles(UserRole.DEALERSHIP_AGENT, UserRole.DEALERSHIP_MANAGER, UserRole.FORD_ADMIN) create(@Body() input: CreateServiceOrderDto, @CurrentUser() actor: AuthenticatedUser) { return this.orders.create(input, actor); }
  @Patch(':id') @Roles(UserRole.DEALERSHIP_AGENT, UserRole.DEALERSHIP_MANAGER, UserRole.FORD_ADMIN) update(@Param('id') id: string, @Body() input: UpdateServiceOrderDto, @CurrentUser() actor: AuthenticatedUser) { return this.orders.update(id, input, actor); }
}
