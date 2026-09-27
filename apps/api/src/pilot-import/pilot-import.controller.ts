import { Body, Controller, Post, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { UserRole } from "@prisma/client";
import { AuthenticatedUser } from "../auth/auth.types";
import { CurrentUser } from "../auth/current-user.decorator";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { Roles } from "../auth/roles.decorator";
import { RolesGuard } from "../auth/roles.guard";
import { PilotImportDto } from "./dto/pilot-import.dto";
import { PilotImportService } from "./pilot-import.service";

@ApiTags("pilot-import")
@ApiBearerAuth()
@Controller("pilot-import")
@UseGuards(JwtAuthGuard, RolesGuard)
export class PilotImportController {
  constructor(private readonly imports: PilotImportService) {}

  @Post()
  @Roles(UserRole.FORD_ADMIN, UserRole.DEALERSHIP_MANAGER)
  import(@Body() input: PilotImportDto, @CurrentUser() actor: AuthenticatedUser) {
    return this.imports.importBatch(input, actor);
  }
}
