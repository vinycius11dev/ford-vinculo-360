import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Put,
  UseGuards,
} from "@nestjs/common";
import { ConsentPurpose, UserRole } from "@prisma/client";
import { AuthenticatedUser } from "../auth/auth.types";
import { CurrentUser } from "../auth/current-user.decorator";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { Roles } from "../auth/roles.decorator";
import { RolesGuard } from "../auth/roles.guard";
import { CreateDataRequestDto } from "./dto/create-data-request.dto";
import { UpdateConsentDto } from "./dto/update-consent.dto";
import { UpdateDataRequestDto } from "./dto/update-data-request.dto";
import { PrivacyService } from "./privacy.service";

@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
@ApiTags('privacy')
@Controller("privacy")
export class PrivacyController {
  constructor(private readonly privacy: PrivacyService) {}
  @Get("me")
  @Roles(
    UserRole.CUSTOMER,
    UserRole.DEALERSHIP_AGENT,
    UserRole.DEALERSHIP_MANAGER,
    UserRole.FORD_ADMIN,
  )
  me(@CurrentUser() actor: AuthenticatedUser) {
    return this.privacy.me(actor);
  }
  @Get("export")
  @Roles(
    UserRole.CUSTOMER,
    UserRole.DEALERSHIP_AGENT,
    UserRole.DEALERSHIP_MANAGER,
    UserRole.FORD_ADMIN,
  )
  exportData(@CurrentUser() actor: AuthenticatedUser) {
    return this.privacy.exportData(actor);
  }
  @Put("consents/:purpose")
  @Roles(
    UserRole.CUSTOMER,
    UserRole.DEALERSHIP_AGENT,
    UserRole.DEALERSHIP_MANAGER,
    UserRole.FORD_ADMIN,
  )
  updateConsent(
    @Param("purpose") purpose: ConsentPurpose,
    @Body() input: UpdateConsentDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.privacy.updateConsent(purpose, input, actor);
  }
  @Post("requests")
  @Roles(
    UserRole.CUSTOMER,
    UserRole.DEALERSHIP_AGENT,
    UserRole.DEALERSHIP_MANAGER,
    UserRole.FORD_ADMIN,
  )
  request(
    @Body() input: CreateDataRequestDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.privacy.createRequest(input, actor);
  }
  @Get("requests")
  @Roles(UserRole.FORD_ADMIN)
  requests() {
    return this.privacy.listRequests();
  }
  @Patch("requests/:id")
  @Roles(UserRole.FORD_ADMIN)
  updateRequest(
    @Param("id") id: string,
    @Body() input: UpdateDataRequestDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.privacy.updateRequest(id, input, actor);
  }
}
