import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
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
import { AuthenticatedUser } from "../auth/auth.types";
import { CurrentUser } from "../auth/current-user.decorator";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { Roles } from "../auth/roles.decorator";
import { RolesGuard } from "../auth/roles.guard";
import { CreateRepurchaseLeadDto } from "./dto/create-repurchase-lead.dto";
import { ExpressRepurchaseInterestDto } from "./dto/express-repurchase-interest.dto";
import { UpdateRepurchaseLeadDto } from "./dto/update-repurchase-lead.dto";
import { RepurchaseLeadsService } from "./repurchase-leads.service";

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(
  UserRole.DEALERSHIP_AGENT,
  UserRole.DEALERSHIP_MANAGER,
  UserRole.FORD_ADMIN,
)
@ApiBearerAuth()
@ApiTags('repurchase-leads')
@Controller("repurchase-leads")
export class RepurchaseLeadsController {
  constructor(private readonly leads: RepurchaseLeadsService) {}

  @Post("interest")
  @Roles(UserRole.CUSTOMER)
  expressInterest(
    @Body() input: ExpressRepurchaseInterestDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.leads.expressInterest(input, actor);
  }

  @Get()
  list(@CurrentUser() actor: AuthenticatedUser) {
    return this.leads.list(actor);
  }

  @Post()
  create(
    @Body() input: CreateRepurchaseLeadDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.leads.create(input, actor);
  }

  @Patch(":id")
  update(
    @Param("id") id: string,
    @Body() input: UpdateRepurchaseLeadDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.leads.update(id, input, actor);
  }
}
