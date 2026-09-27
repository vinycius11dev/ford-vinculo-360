import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Controller, Get, UseGuards } from "@nestjs/common";
import { UserRole } from "@prisma/client";
import { AuthenticatedUser } from "../auth/auth.types";
import { CurrentUser } from "../auth/current-user.decorator";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { Roles } from "../auth/roles.decorator";
import { RolesGuard } from "../auth/roles.guard";
import { AuditService } from "./audit.service";

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.DEALERSHIP_MANAGER, UserRole.FORD_ADMIN)
@ApiBearerAuth()
@ApiTags('audit-logs')
@Controller("audit-logs")
export class AuditController {
  constructor(private readonly audit: AuditService) {}

  @Get()
  list(@CurrentUser() actor: AuthenticatedUser) {
    return this.audit.list(actor);
  }
}
