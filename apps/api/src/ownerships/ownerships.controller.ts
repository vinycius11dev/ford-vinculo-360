import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { AuthenticatedUser } from '../auth/auth.types';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { ClaimVehicleDto } from './dto/claim-vehicle.dto';
import { SelfRegisterVehicleDto } from './dto/self-register-vehicle.dto';
import { TransferVehicleDto } from './dto/transfer-vehicle.dto';
import { OwnershipsService } from './ownerships.service';

@ApiTags('ownerships')
@Controller('ownerships')
export class OwnershipsController {
  constructor(private readonly ownerships: OwnershipsService) {}
  @Get()
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  list(@CurrentUser() actor: AuthenticatedUser) { return this.ownerships.list(actor); }

  /** Lista enxuta, sem autenticação, usada apenas no primeiro cadastro. */
  @Get('dealerships') publicDealerships() { return this.ownerships.publicDealerships(); }

  /** Modelos, anos e cores reconhecidos pela Rede Ford para o autocadastro. */
  @Get('vehicle-options') publicVehicleOptions() { return this.ownerships.publicVehicleOptions(); }

  /**
   * Entrada pública: registra o interesse e deixa o vínculo em análise. A
   * posse do veículo nunca é concedida apenas com dados informados no app.
   */
  @Post('self-registration') selfRegistration(@Body() input: SelfRegisterVehicleDto) {
    return this.ownerships.selfRegistration(input);
  }

  @Post('claim')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.CUSTOMER)
  claim(@Body() input: ClaimVehicleDto, @CurrentUser() actor: AuthenticatedUser) { return this.ownerships.claim(input, actor); }

  @Post('transfer')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.DEALERSHIP_AGENT, UserRole.DEALERSHIP_MANAGER, UserRole.FORD_ADMIN)
  transfer(@Body() input: TransferVehicleDto, @CurrentUser() actor: AuthenticatedUser) { return this.ownerships.transfer(input, actor); }
}
