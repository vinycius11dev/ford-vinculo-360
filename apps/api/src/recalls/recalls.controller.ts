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
import { CreateRecallDto } from "./dto/create-recall.dto";
import { UpdateRecallTargetDto } from "./dto/update-recall-target.dto";
import { RecallsService } from "./recalls.service";

@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
@ApiTags('recalls')
@Controller("recalls")
export class RecallsController {
  constructor(private readonly recalls: RecallsService) {}

  @Get()
  @Roles(
    UserRole.CUSTOMER,
    UserRole.DEALERSHIP_AGENT,
    UserRole.DEALERSHIP_MANAGER,
    UserRole.FORD_ADMIN,
  )
  list(@CurrentUser() actor: AuthenticatedUser) {
    return this.recalls.list(actor);
  }
  @Post()
  @Roles(UserRole.DEALERSHIP_MANAGER, UserRole.FORD_ADMIN)
  create(
    @Body() input: CreateRecallDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.recalls.create(input, actor);
  }
  @Post(":id/notify")
  @Roles(UserRole.DEALERSHIP_MANAGER, UserRole.FORD_ADMIN)
  notify(@Param("id") id: string, @CurrentUser() actor: AuthenticatedUser) {
    return this.recalls.notify(id, actor);
  }
  @Patch("targets/:targetId")
  @Roles(
    UserRole.DEALERSHIP_AGENT,
    UserRole.DEALERSHIP_MANAGER,
    UserRole.FORD_ADMIN,
  )
  updateTarget(
    @Param("targetId") targetId: string,
    @Body() input: UpdateRecallTargetDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.recalls.updateTarget(targetId, input, actor);
  }
}
