import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Body, Controller, Get, Param, Patch, Post, UseGuards } from "@nestjs/common";
import { UserRole } from "@prisma/client";
import { AuthenticatedUser } from "../auth/auth.types";
import { CurrentUser } from "../auth/current-user.decorator";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { Roles } from "../auth/roles.decorator";
import { RolesGuard } from "../auth/roles.guard";
import { CreateSupportTicketDto } from "./dto/create-support-ticket.dto";
import { CreateSupportMessageDto } from "./dto/create-support-message.dto";
import { UpdateSupportTicketDto } from "./dto/update-support-ticket.dto";
import { ResolveVehicleValidationDto } from "./dto/resolve-vehicle-validation.dto";
import { SupportService } from "./support.service";

@ApiTags('support-tickets')
@Controller("support-tickets")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(
  UserRole.CUSTOMER,
  UserRole.DEALERSHIP_AGENT,
  UserRole.DEALERSHIP_MANAGER,
  UserRole.FORD_ADMIN,
)
export class SupportController {
  constructor(private readonly support: SupportService) {}

  @Get()
  list(@CurrentUser() actor: AuthenticatedUser) {
    return this.support.list(actor);
  }

  @Post()
  create(
    @Body() input: CreateSupportTicketDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.support.create(input, actor);
  }

  @Get(":id/messages")
  messages(
    @Param("id") id: string,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.support.messages(id, actor);
  }

  @Post(":id/messages")
  sendMessage(
    @Param("id") id: string,
    @Body() input: CreateSupportMessageDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.support.sendMessage(id, input, actor);
  }

  @Patch(":id/messages/read")
  markMessagesRead(
    @Param("id") id: string,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.support.markMessagesRead(id, actor);
  }

  @Patch(":id")
  @Roles(UserRole.DEALERSHIP_MANAGER, UserRole.FORD_ADMIN)
  update(
    @Param("id") id: string,
    @Body() input: UpdateSupportTicketDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.support.update(id, input, actor);
  }

  /** Aprovação manual da posse: exclusiva da gestão e rastreada na auditoria. */
  @Patch(":id/vehicle-validation")
  @Roles(UserRole.DEALERSHIP_MANAGER, UserRole.FORD_ADMIN)
  resolveVehicleValidation(
    @Param("id") id: string,
    @Body() input: ResolveVehicleValidationDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.support.resolveVehicleValidation(id, input, actor);
  }
}
