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
import { CreateNotificationDto } from "./dto/create-notification.dto";
import { NotificationsService } from "./notifications.service";

@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
@ApiTags('notifications')
@Controller("notifications")
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  @Get()
  @Roles(
    UserRole.CUSTOMER,
    UserRole.DEALERSHIP_AGENT,
    UserRole.DEALERSHIP_MANAGER,
    UserRole.FORD_ADMIN,
  )
  list(@CurrentUser() actor: AuthenticatedUser) {
    return this.notifications.list(actor);
  }

  @Patch(":id/read")
  @Roles(
    UserRole.CUSTOMER,
    UserRole.DEALERSHIP_AGENT,
    UserRole.DEALERSHIP_MANAGER,
    UserRole.FORD_ADMIN,
  )
  markRead(@Param("id") id: string, @CurrentUser() actor: AuthenticatedUser) {
    return this.notifications.markRead(id, actor);
  }

  @Post()
  @Roles(UserRole.DEALERSHIP_MANAGER, UserRole.FORD_ADMIN)
  create(
    @Body() input: CreateNotificationDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.notifications.create(input, actor);
  }
}
