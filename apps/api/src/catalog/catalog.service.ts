import { BadRequestException, ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma, VehicleModel } from "@prisma/client";
import { mkdir, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { join, resolve } from "node:path";
import { AuthenticatedUser } from "../auth/auth.types";
import { PrismaService } from "../prisma/prisma.service";
import { CreateCatalogItemDto } from "./dto/create-catalog-item.dto";
import { CreateVehicleModelDto } from "./dto/create-vehicle-model.dto";
import { UpdateCatalogItemDto } from "./dto/update-catalog-item.dto";
import { UpdateVehicleModelDto } from "./dto/update-vehicle-model.dto";

@Injectable()
export class CatalogService {
  constructor(private readonly prisma: PrismaService) {}

  listPublished() {
    return this.prisma.catalogItem.findMany({
      where: { published: true, vehicleModel: { published: true } },
      include: { vehicleModel: true },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
    });
  }

  listAdmin() {
    return this.prisma.catalogItem.findMany({
      include: { vehicleModel: true },
      orderBy: [{ published: "desc" }, { sortOrder: "asc" }, { createdAt: "desc" }],
    });
  }

  listModels(publishedOnly = false) {
    return this.prisma.vehicleModel.findMany({
      where: publishedOnly ? { published: true } : undefined,
      include: { _count: { select: { variants: true } } },
      orderBy: [{ name: "asc" }, { modelYear: "desc" }],
    });
  }

  async createModel(input: CreateVehicleModelDto, actor: AuthenticatedUser) {
    const slug = await this.uniqueModelSlug(input.slug || `${input.name}-${input.modelYear}`);
    try {
      const model = await this.prisma.vehicleModel.create({
        data: {
          slug,
          name: input.name.trim(),
          modelCode: input.modelCode?.trim() || null,
          modelYear: input.modelYear,
          category: input.category.trim(),
          summary: input.summary.trim(),
          description: input.description.trim(),
          dimensions: input.dimensions?.trim() || null,
          seats: input.seats ?? null,
          doors: input.doors ?? null,
          warrantyLabel: input.warrantyLabel?.trim() || null,
          basePrice: input.basePrice,
          imageUrl: input.imageUrl?.trim() || null,
          ...(input.technicalSpecifications ? { technicalSpecifications: input.technicalSpecifications as Prisma.InputJsonValue } : {}),
          ...(input.standardEquipment ? { standardEquipment: input.standardEquipment as Prisma.InputJsonValue } : {}),
          published: input.published ?? true,
        },
      });
      await this.audit(actor, "VEHICLE_MODEL_CREATE", model.id, "VehicleModel", { name: model.name, modelYear: model.modelYear });
      return model;
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002")
        throw new ConflictException("Já existe um modelo com este nome e ano.");
      throw error;
    }
  }

  async updateModel(id: string, input: UpdateVehicleModelDto, actor: AuthenticatedUser) {
    const current = await this.prisma.vehicleModel.findUnique({ where: { id } });
    if (!current) throw new NotFoundException("Modelo não encontrado.");
    const slug = input.slug || input.name || input.modelYear
      ? await this.uniqueModelSlug(input.slug || `${input.name ?? current.name}-${input.modelYear ?? current.modelYear}`, id)
      : current.slug;
    const data: Prisma.VehicleModelUpdateInput = { slug };
    if (input.name !== undefined) data.name = input.name.trim();
    if (input.modelCode !== undefined) data.modelCode = input.modelCode?.trim() || null;
    if (input.modelYear !== undefined) data.modelYear = input.modelYear;
    if (input.category !== undefined) data.category = input.category.trim();
    if (input.summary !== undefined) data.summary = input.summary.trim();
    if (input.description !== undefined) data.description = input.description.trim();
    if (input.dimensions !== undefined) data.dimensions = input.dimensions?.trim() || null;
    if (input.seats !== undefined) data.seats = input.seats;
    if (input.doors !== undefined) data.doors = input.doors;
    if (input.warrantyLabel !== undefined) data.warrantyLabel = input.warrantyLabel?.trim() || null;
    if (input.basePrice !== undefined) data.basePrice = input.basePrice;
    if (input.imageUrl !== undefined) data.imageUrl = input.imageUrl?.trim() || null;
    if (input.technicalSpecifications !== undefined) data.technicalSpecifications = input.technicalSpecifications as Prisma.InputJsonValue;
    if (input.standardEquipment !== undefined) data.standardEquipment = input.standardEquipment as Prisma.InputJsonValue;
    if (input.published !== undefined) data.published = input.published;
    try {
      const model = await this.prisma.$transaction(async (tx) => {
        const saved = await tx.vehicleModel.update({ where: { id }, data });
        await tx.catalogItem.updateMany({
          where: { modelId: id },
          data: {
            name: saved.name,
            modelCode: saved.modelCode,
            modelYear: saved.modelYear,
            category: saved.category,
            summary: saved.summary,
            description: saved.description,
            dimensions: saved.dimensions,
            seats: saved.seats,
            doors: saved.doors,
            warrantyLabel: saved.warrantyLabel,
          },
        });
        const variants = await tx.catalogItem.findMany({
          where: { modelId: id },
          select: { id: true, additionalPrice: true },
        });
        await Promise.all(
          variants.map((variant) =>
            tx.catalogItem.update({
              where: { id: variant.id },
              data: { priceLabel: this.priceLabel(saved.basePrice + variant.additionalPrice) },
            }),
          ),
        );
        if (input.imageUrl !== undefined) {
          const inheritedVariants = await tx.catalogItem.findMany({
            where: {
              modelId: id,
              OR: current.imageUrl ? [{ imageUrl: null }, { imageUrl: current.imageUrl }] : [{ imageUrl: null }],
            },
            select: { id: true },
          });
          const inheritedVariantIds = inheritedVariants.map((variant) => variant.id);
          if (inheritedVariantIds.length) {
            await tx.catalogItem.updateMany({ where: { id: { in: inheritedVariantIds } }, data: { imageUrl: saved.imageUrl } });
            await tx.vehicle.updateMany({
              where: {
                catalogItemId: { in: inheritedVariantIds },
                OR: current.imageUrl ? [{ imageUrl: null }, { imageUrl: current.imageUrl }] : [{ imageUrl: null }],
              },
              data: { imageUrl: saved.imageUrl },
            });
          }
        }
        return saved;
      });
      await this.audit(actor, "VEHICLE_MODEL_UPDATE", model.id, "VehicleModel", { name: model.name, modelYear: model.modelYear });
      return model;
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002")
        throw new ConflictException("Já existe um modelo com este nome e ano.");
      throw error;
    }
  }

  async removeModel(id: string, actor: AuthenticatedUser) {
    const current = await this.prisma.vehicleModel.findUnique({ where: { id }, include: { _count: { select: { variants: true } } } });
    if (!current) throw new NotFoundException("Modelo não encontrado.");
    if (current._count.variants)
      throw new BadRequestException("Remova primeiro as variações vinculadas a este modelo.");
    await this.prisma.vehicleModel.delete({ where: { id } });
    await this.audit(actor, "VEHICLE_MODEL_DELETE", id, "VehicleModel", { name: current.name, modelYear: current.modelYear });
    return { id, deleted: true };
  }

  async create(input: CreateCatalogItemDto, actor: AuthenticatedUser) {
    const model = await this.requireModel(input.modelId);
    const slug = await this.uniqueSlug(input.slug || `${model.name}-${input.version}-${input.exteriorColor}`);
    const item = await this.prisma.catalogItem.create({ data: this.toCreateData(input, slug, model) });
    await this.audit(actor, "CATALOG_ITEM_CREATE", item.id, "CatalogItem", { modelId: model.id, version: item.version, exteriorColor: item.exteriorColor });
    return this.prisma.catalogItem.findUnique({ where: { id: item.id }, include: { vehicleModel: true } });
  }

  async update(id: string, input: UpdateCatalogItemDto, actor: AuthenticatedUser) {
    const current = await this.prisma.catalogItem.findUnique({ where: { id } });
    if (!current) throw new NotFoundException("Variação não encontrada.");
    const model = await this.requireModel(input.modelId ?? current.modelId);
    const slug = input.slug || input.version || input.exteriorColor
      ? await this.uniqueSlug(input.slug || `${model.name}-${input.version ?? current.version}-${input.exteriorColor ?? current.exteriorColor ?? "configuracao"}`, id)
      : current.slug;
    const data = this.toUpdateData(input, slug, model);
    data.priceLabel = this.priceLabel(model.basePrice + (input.additionalPrice ?? current.additionalPrice));
    const item = await this.prisma.catalogItem.update({ where: { id }, data });
    await this.audit(actor, "CATALOG_ITEM_UPDATE", item.id, "CatalogItem", { modelId: model.id, version: item.version, exteriorColor: item.exteriorColor });
    return this.prisma.catalogItem.findUnique({ where: { id: item.id }, include: { vehicleModel: true } });
  }

  async remove(id: string, actor: AuthenticatedUser) {
    const current = await this.prisma.catalogItem.findUnique({ where: { id }, include: { _count: { select: { vehicles: true } } } });
    if (!current) throw new NotFoundException("Variação não encontrada.");
    if (current._count.vehicles)
      throw new BadRequestException("Esta variação já possui unidades no estoque e não pode ser removida.");
    await this.prisma.catalogItem.delete({ where: { id } });
    await this.audit(actor, "CATALOG_ITEM_DELETE", id, "CatalogItem", { version: current.version });
    return { id, deleted: true };
  }

  async saveImage(file: { mimetype: string; buffer: Buffer }, origin: string, actor: AuthenticatedUser) {
    const buffer = file.buffer;
    const isPng = buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
    const isJpeg = buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
    const isWebp = buffer.length >= 12 && buffer.toString("ascii", 0, 4) === "RIFF" && buffer.toString("ascii", 8, 12) === "WEBP";
    const detectedMime = isPng ? "image/png" : isJpeg ? "image/jpeg" : isWebp ? "image/webp" : null;
    if (!detectedMime || detectedMime !== file.mimetype) {
      throw new BadRequestException("O cabeçalho do arquivo não corresponde a JPG, PNG ou WebP.");
    }
    const extension = detectedMime === "image/jpeg" ? "jpg" : detectedMime.split("/")[1];
    const directory = resolve(__dirname, "../../uploads/catalog");
    const filename = `${randomUUID()}.${extension}`;
    await mkdir(directory, { recursive: true });
    await writeFile(join(directory, filename), buffer);
    const url = `${origin}/uploads/catalog/${filename}`;
    await this.prisma.auditLog.create({
      data: { performedById: actor.userId, action: "CATALOG_IMAGE_UPLOAD", entityType: "CatalogItem", metadata: { url } },
    });
    return { url };
  }

  private async requireModel(id: string) {
    const model = await this.prisma.vehicleModel.findUnique({ where: { id } });
    if (!model) throw new NotFoundException("Modelo principal não encontrado.");
    return model;
  }

  private toCreateData(input: CreateCatalogItemDto, slug: string, model: VehicleModel): Prisma.CatalogItemCreateInput {
    const exteriorColor = input.exteriorColor.trim();
    const interiorColor = input.interiorColor.trim();
    const additionalPrice = input.additionalPrice ?? 0;
    return {
      slug,
      vehicleModel: { connect: { id: model.id } },
      name: model.name,
      modelCode: model.modelCode,
      modelYear: model.modelYear,
      version: input.version.trim(),
      category: model.category,
      summary: model.summary,
      description: model.description,
      highlights: input.highlights?.trim() || null,
      engine: input.engine?.trim() || null,
      fuelType: input.fuelType?.trim() || null,
      transmission: input.transmission?.trim() || null,
      drive: input.drive?.trim() || null,
      power: input.power?.trim() || null,
      torque: input.torque?.trim() || null,
      consumption: input.consumption?.trim() || null,
      rangeLabel: input.rangeLabel?.trim() || null,
      dimensions: model.dimensions,
      seats: model.seats,
      doors: model.doors,
      exteriorColor,
      interiorColor,
      exteriorColors: [exteriorColor],
      interiorColors: [interiorColor],
      additionalPrice,
      ...(input.configurationDetails ? { configurationDetails: input.configurationDetails as Prisma.InputJsonValue } : {}),
      ...(input.equipment ? { equipment: input.equipment as Prisma.InputJsonValue } : {}),
      warrantyLabel: model.warrantyLabel,
      imageUrl: input.imageUrl?.trim() || model.imageUrl,
      priceLabel: this.priceLabel(model.basePrice + additionalPrice),
      stockLabel: input.stockLabel?.trim() || null,
      ctaLabel: input.ctaLabel?.trim() || "Tenho interesse",
      sortOrder: input.sortOrder ?? 0,
      published: input.published ?? true,
    };
  }

  private toUpdateData(input: UpdateCatalogItemDto, slug: string, model: VehicleModel): Prisma.CatalogItemUpdateInput {
    const data: Prisma.CatalogItemUpdateInput = {
      slug,
      vehicleModel: { connect: { id: model.id } },
      name: model.name,
      modelCode: model.modelCode,
      modelYear: model.modelYear,
      category: model.category,
      summary: model.summary,
      description: model.description,
      dimensions: model.dimensions,
      seats: model.seats,
      doors: model.doors,
      warrantyLabel: model.warrantyLabel,
    };
    if (input.version !== undefined) data.version = input.version?.trim() || null;
    if (input.highlights !== undefined) data.highlights = input.highlights?.trim() || null;
    if (input.engine !== undefined) data.engine = input.engine?.trim() || null;
    if (input.fuelType !== undefined) data.fuelType = input.fuelType?.trim() || null;
    if (input.transmission !== undefined) data.transmission = input.transmission?.trim() || null;
    if (input.drive !== undefined) data.drive = input.drive?.trim() || null;
    if (input.power !== undefined) data.power = input.power?.trim() || null;
    if (input.torque !== undefined) data.torque = input.torque?.trim() || null;
    if (input.consumption !== undefined) data.consumption = input.consumption?.trim() || null;
    if (input.rangeLabel !== undefined) data.rangeLabel = input.rangeLabel?.trim() || null;
    if (input.exteriorColor !== undefined) {
      const color = input.exteriorColor.trim();
      data.exteriorColor = color;
      data.exteriorColors = [color];
    }
    if (input.interiorColor !== undefined) {
      const color = input.interiorColor.trim();
      data.interiorColor = color;
      data.interiorColors = [color];
    }
    if (input.additionalPrice !== undefined) {
      data.additionalPrice = input.additionalPrice;
      data.priceLabel = this.priceLabel(model.basePrice + input.additionalPrice);
    }
    if (input.configurationDetails !== undefined) data.configurationDetails = input.configurationDetails as Prisma.InputJsonValue;
    if (input.equipment !== undefined) data.equipment = input.equipment as Prisma.InputJsonValue;
    if (input.imageUrl !== undefined) data.imageUrl = input.imageUrl?.trim() || model.imageUrl;
    if (input.stockLabel !== undefined) data.stockLabel = input.stockLabel?.trim() || null;
    if (input.ctaLabel !== undefined) data.ctaLabel = input.ctaLabel.trim() || "Tenho interesse";
    if (input.sortOrder !== undefined) data.sortOrder = input.sortOrder;
    if (input.published !== undefined) data.published = input.published;
    return data;
  }

  private async uniqueSlug(value: string, ignoreId?: string) {
    return this.uniqueSlugFor(value, (slug) => this.prisma.catalogItem.findFirst({ where: { slug, ...(ignoreId ? { NOT: { id: ignoreId } } : {}) }, select: { id: true } }));
  }

  private async uniqueModelSlug(value: string, ignoreId?: string) {
    return this.uniqueSlugFor(value, (slug) => this.prisma.vehicleModel.findFirst({ where: { slug, ...(ignoreId ? { NOT: { id: ignoreId } } : {}) }, select: { id: true } }));
  }

  private async uniqueSlugFor(value: string, exists: (slug: string) => Promise<{ id: string } | null>) {
    const base = value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 100) || "item";
    let slug = base;
    let suffix = 2;
    while (await exists(slug)) slug = `${base}-${suffix++}`;
    return slug;
  }

  private priceLabel(value: number) {
    return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(value);
  }

  private audit(actor: AuthenticatedUser, action: string, entityId: string, entityType: string, metadata: Prisma.InputJsonValue) {
    return this.prisma.auditLog.create({ data: { performedById: actor.userId, action, entityType, entityId, metadata } });
  }
}
