import { Body, Controller, Get, Post, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { UserRole } from "@prisma/client";
import { AuthenticatedUser } from "../auth/auth.types";
import { CurrentUser } from "../auth/current-user.decorator";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { Roles } from "../auth/roles.decorator";
import { RolesGuard } from "../auth/roles.guard";
import { RegisterSaleDto } from "./dto/register-sale.dto";
import { SalesService } from "./sales.service";

@ApiTags("sales")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(
  UserRole.DEALERSHIP_AGENT,
  UserRole.DEALERSHIP_MANAGER,
  UserRole.FORD_ADMIN,
)
@Controller("sales")
export class SalesController {
  constructor(private readonly sales: SalesService) {}

  @Get("stock")
  stock(@CurrentUser() actor: AuthenticatedUser) {
    return this.sales.stock(actor);
  }

  @Get()
  history(@CurrentUser() actor: AuthenticatedUser) {
    return this.sales.history(actor);
  }

  @Post()
  register(
    @Body() input: RegisterSaleDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.sales.register(input, actor);
  }
}
