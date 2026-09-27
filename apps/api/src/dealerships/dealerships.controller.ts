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
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { Roles } from "../auth/roles.decorator";
import { RolesGuard } from "../auth/roles.guard";
import { DealershipsService } from "./dealerships.service";
import { CreateDealershipDto } from "./dto/create-dealership.dto";
import { UpdateDealershipDto } from "./dto/update-dealership.dto";
import { CurrentUser } from "../auth/current-user.decorator";
import { AuthenticatedUser } from "../auth/auth.types";

@ApiTags("dealerships")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller("dealerships")
export class DealershipsController {
  constructor(private readonly dealerships: DealershipsService) {}
  @Get()
  @Roles(
    UserRole.CUSTOMER,
    UserRole.FORD_ADMIN,
    UserRole.DEALERSHIP_MANAGER,
    UserRole.DEALERSHIP_AGENT,
  )
  list() {
    return this.dealerships.list();
  }
  @Post() @Roles(UserRole.FORD_ADMIN) create(
    @Body() input: CreateDealershipDto,
  ) {
    return this.dealerships.create(input);
  }
  @Patch(":id") @Roles(UserRole.FORD_ADMIN, UserRole.DEALERSHIP_MANAGER) update(
    @Param("id") id: string,
    @Body() input: UpdateDealershipDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.dealerships.update(id, input, actor);
  }
}
