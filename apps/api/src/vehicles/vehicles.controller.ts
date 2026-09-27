import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { ApiCreatedResponse, ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { AuthenticatedUser } from '../auth/auth.types';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { CreateVehicleDto } from './dto/create-vehicle.dto';
import { CreateVehicleBatchDto } from './dto/create-vehicle-batch.dto';
import { VehiclesService } from './vehicles.service';

@ApiTags('vehicles')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
@Controller('vehicles')
export class VehiclesController {
  constructor(private readonly vehicles: VehiclesService) {}

  @Get()
  list(@CurrentUser() actor: AuthenticatedUser) {
    return this.vehicles.list(actor);
  }

  @Get(':vin')
  findByVin(@Param('vin') vin: string, @CurrentUser() actor: AuthenticatedUser) {
    return this.vehicles.findByVin(vin, actor);
  }

  @Post()
  @Roles(UserRole.FORD_ADMIN, UserRole.DEALERSHIP_MANAGER, UserRole.DEALERSHIP_AGENT)
  @ApiCreatedResponse({ description: 'Veículo criado a partir de sua identidade VIN.' })
  create(@Body() input: CreateVehicleDto, @CurrentUser() actor: AuthenticatedUser) {
    return this.vehicles.create(input, actor);
  }

  @Post('batch')
  @Roles(UserRole.FORD_ADMIN, UserRole.DEALERSHIP_MANAGER, UserRole.DEALERSHIP_AGENT)
  @ApiCreatedResponse({ description: 'Até 1.000 unidades criadas a partir da mesma variação.' })
  createBatch(@Body() input: CreateVehicleBatchDto, @CurrentUser() actor: AuthenticatedUser) {
    return this.vehicles.createBatch(input, actor);
  }
}
