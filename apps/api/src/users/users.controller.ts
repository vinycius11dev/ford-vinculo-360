import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from "@nestjs/common";
import { UserRole } from "@prisma/client";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { AuthenticatedUser } from "../auth/auth.types";
import { CurrentUser } from "../auth/current-user.decorator";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { Roles } from "../auth/roles.decorator";
import { RolesGuard } from "../auth/roles.guard";
import { UsersService } from "./users.service";
import { CreateTeamMemberDto } from "./dto/create-team-member.dto";
import { UpdateTeamMemberDto } from "./dto/update-team-member.dto";
import { CreateTeamInvitationDto } from "./dto/create-team-invitation.dto";
import { CustomerProfileDto } from "./dto/customer-profile.dto";

@ApiTags("users")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(
  UserRole.FORD_ADMIN,
  UserRole.DEALERSHIP_MANAGER,
  UserRole.DEALERSHIP_AGENT,
)
@Controller("users")
export class UsersController {
  constructor(private readonly users: UsersService) {}
  @Get() list(@CurrentUser() actor: AuthenticatedUser) {
    return this.users.list(actor);
  }
  @Get("team/invitations")
  @Roles(UserRole.FORD_ADMIN, UserRole.DEALERSHIP_MANAGER)
  listInvitations(@CurrentUser() actor: AuthenticatedUser) {
    return this.users.listInvitations(actor);
  }
  @Post("team/invitations")
  @Roles(UserRole.FORD_ADMIN, UserRole.DEALERSHIP_MANAGER)
  createInvitation(
    @Body() input: CreateTeamInvitationDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.users.createInvitation(input, actor);
  }
  @Patch("team/invitations/:id/cancel")
  @Roles(UserRole.FORD_ADMIN, UserRole.DEALERSHIP_MANAGER)
  cancelInvitation(
    @Param("id") id: string,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.users.cancelInvitation(id, actor);
  }
  @Get("customers")
  listCustomers(@CurrentUser() actor: AuthenticatedUser) {
    return this.users.listCustomers(actor);
  }
  @Post("customers")
  createCustomer(
    @Body() input: CustomerProfileDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.users.createCustomer(input, actor);
  }
  @Get("customers/lookup/cep/:cep")
  lookupCustomerZip(@Param("cep") cep: string) {
    return this.users.lookupCustomerZip(cep);
  }
  @Get("customers/lookup/cnpj/:cnpj")
  lookupCustomerCnpj(@Param("cnpj") cnpj: string) {
    return this.users.lookupCustomerCnpj(cnpj);
  }
  @Get("customers/:id")
  findCustomer(
    @Param("id") id: string,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.users.findCustomer(id, actor);
  }
  @Patch("customers/:id")
  updateCustomer(
    @Param("id") id: string,
    @Body() input: CustomerProfileDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.users.updateCustomer(id, input, actor);
  }
  @Get(":id") findOne(
    @Param("id") id: string,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.users.findOne(id, actor);
  }
  @Post("team")
  @Roles(UserRole.FORD_ADMIN, UserRole.DEALERSHIP_MANAGER)
  createTeamMember(
    @Body() input: CreateTeamMemberDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.users.createTeamMember(input, actor);
  }
  @Patch(":id/team")
  @Roles(UserRole.FORD_ADMIN, UserRole.DEALERSHIP_MANAGER)
  updateTeamMember(
    @Param("id") id: string,
    @Body() input: UpdateTeamMemberDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.users.updateTeamMember(id, input, actor);
  }
}
