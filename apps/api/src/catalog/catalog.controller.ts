import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { BadRequestException, Body, Controller, Delete, Get, Param, Patch, Post, Req, UploadedFile, UseGuards, UseInterceptors } from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { UserRole } from "@prisma/client";
import { AuthenticatedUser } from "../auth/auth.types";
import { CurrentUser } from "../auth/current-user.decorator";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { Roles } from "../auth/roles.decorator";
import { RolesGuard } from "../auth/roles.guard";
import { Throttle } from "@nestjs/throttler";
import { CatalogService } from "./catalog.service";
import { CreateCatalogItemDto } from "./dto/create-catalog-item.dto";
import { CreateVehicleModelDto } from "./dto/create-vehicle-model.dto";
import { UpdateCatalogItemDto } from "./dto/update-catalog-item.dto";
import { UpdateVehicleModelDto } from "./dto/update-vehicle-model.dto";

@ApiTags('catalog')
@Controller("catalog")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
export class CatalogController {
  constructor(private readonly catalog: CatalogService) {}

  @Get()
  @Roles(UserRole.CUSTOMER, UserRole.DEALERSHIP_AGENT, UserRole.DEALERSHIP_MANAGER, UserRole.FORD_ADMIN)
  listPublished() { return this.catalog.listPublished(); }

  @Get("admin")
  @Roles(UserRole.DEALERSHIP_MANAGER, UserRole.FORD_ADMIN)
  listAdmin() { return this.catalog.listAdmin(); }

  @Get("models")
  @Roles(UserRole.CUSTOMER, UserRole.DEALERSHIP_AGENT, UserRole.DEALERSHIP_MANAGER, UserRole.FORD_ADMIN)
  listModels(@CurrentUser() actor: AuthenticatedUser) {
    return this.catalog.listModels(actor.role === UserRole.CUSTOMER || actor.role === UserRole.DEALERSHIP_AGENT);
  }

  @Post("models")
  @Roles(UserRole.DEALERSHIP_MANAGER, UserRole.FORD_ADMIN)
  createModel(@Body() input: CreateVehicleModelDto, @CurrentUser() actor: AuthenticatedUser) {
    return this.catalog.createModel(input, actor);
  }

  @Patch("models/:id")
  @Roles(UserRole.DEALERSHIP_MANAGER, UserRole.FORD_ADMIN)
  updateModel(@Param("id") id: string, @Body() input: UpdateVehicleModelDto, @CurrentUser() actor: AuthenticatedUser) {
    return this.catalog.updateModel(id, input, actor);
  }

  @Delete("models/:id")
  @Roles(UserRole.DEALERSHIP_MANAGER, UserRole.FORD_ADMIN)
  removeModel(@Param("id") id: string, @CurrentUser() actor: AuthenticatedUser) {
    return this.catalog.removeModel(id, actor);
  }

  @Post("upload")
  @Roles(UserRole.DEALERSHIP_MANAGER, UserRole.FORD_ADMIN)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @UseInterceptors(FileInterceptor("file", {
    limits: { fileSize: 5 * 1024 * 1024 },
    fileFilter: (_request, file, callback) => {
      if (["image/jpeg", "image/png", "image/webp"].includes(file.mimetype)) callback(null, true);
      else callback(new BadRequestException("Envie uma imagem JPG, PNG ou WebP."), false);
    },
  }))
  async upload(@UploadedFile() file: { mimetype: string; buffer: Buffer } | undefined, @Req() request: { protocol: string; get(name: string): string | undefined }, @CurrentUser() actor: AuthenticatedUser) {
    if (!file) throw new BadRequestException("Selecione uma imagem para enviar.");
    const configuredOrigin = process.env.PUBLIC_API_ORIGIN?.trim().replace(/\/$/, "");
    const origin = configuredOrigin || `${request.protocol}://${request.get("host") ?? "127.0.0.1:3000"}`;
    return this.catalog.saveImage(file, origin, actor);
  }

  @Post()
  @Roles(UserRole.DEALERSHIP_MANAGER, UserRole.FORD_ADMIN)
  create(@Body() input: CreateCatalogItemDto, @CurrentUser() actor: AuthenticatedUser) { return this.catalog.create(input, actor); }

  @Patch(":id")
  @Roles(UserRole.DEALERSHIP_MANAGER, UserRole.FORD_ADMIN)
  update(@Param("id") id: string, @Body() input: UpdateCatalogItemDto, @CurrentUser() actor: AuthenticatedUser) { return this.catalog.update(id, input, actor); }

  @Delete(":id")
  @Roles(UserRole.DEALERSHIP_MANAGER, UserRole.FORD_ADMIN)
  remove(@Param("id") id: string, @CurrentUser() actor: AuthenticatedUser) { return this.catalog.remove(id, actor); }
}
