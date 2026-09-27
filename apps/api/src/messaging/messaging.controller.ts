import { Controller, Get, Param, Post, Query, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { MessageChannel, MessageStatus, UserRole } from "@prisma/client";
import { AuthenticatedUser } from "../auth/auth.types";
import { CurrentUser } from "../auth/current-user.decorator";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { Roles } from "../auth/roles.decorator";
import { RolesGuard } from "../auth/roles.guard";
import { MessagingService } from "./messaging.service";

@ApiTags("messaging")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller("messaging")
export class MessagingController {
  constructor(private readonly messaging: MessagingService) {}

  @Get()
  @Roles(UserRole.FORD_ADMIN)
  list(
    @CurrentUser() actor: AuthenticatedUser,
    @Query("status") status?: MessageStatus,
    @Query("channel") channel?: MessageChannel,
  ) {
    return this.messaging.list(actor, { status, channel });
  }

  @Get(":id")
  @Roles(UserRole.FORD_ADMIN)
  findOne(@Param("id") id: string, @CurrentUser() actor: AuthenticatedUser) {
    return this.messaging.findOne(id, actor);
  }

  @Post(":id/retry")
  @Roles(UserRole.FORD_ADMIN)
  retry(@Param("id") id: string, @CurrentUser() actor: AuthenticatedUser) {
    return this.messaging.retry(id, actor);
  }

  @Post(":id/cancel")
  @Roles(UserRole.FORD_ADMIN)
  cancel(@Param("id") id: string, @CurrentUser() actor: AuthenticatedUser) {
    return this.messaging.cancel(id, actor);
  }
}
