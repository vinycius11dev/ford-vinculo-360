import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, UserRole, VehicleCondition, VehicleSaleStatus } from '@prisma/client';
import { AuthenticatedUser } from '../auth/auth.types';
import { PrismaService } from '../prisma/prisma.service';
import { CreateVehicleDto } from './dto/create-vehicle.dto';
import { CreateVehicleBatchDto } from './dto/create-vehicle-batch.dto';
import { vehicleScope } from '../common/access-scope';

@Injectable()
export class VehiclesService {
  constructor(private readonly prisma: PrismaService) {}

  async list(actor: AuthenticatedUser) {
    const where: Prisma.VehicleWhereInput = actor.role === UserRole.CUSTOMER
      ? { ownerships: { some: { userId: actor.userId, status: 'ACTIVE' } } }
      : actor.role === UserRole.FORD_ADMIN
        ? {}
        : { OR: [{ stockDealershipId: actor.dealershipId ?? '__none__' }, { originDealershipId: actor.dealershipId ?? '__none__' }, { serviceOrders: { some: { dealershipId: actor.dealershipId ?? '__none__' } } }] };
    return this.prisma.vehicle.findMany({
      where,
      select: {
        vin: true,
        plate: true,
        model: true,
        version: true,
        exteriorColor: true,
        interiorColor: true,
        engine: true,
        fuelType: true,
        transmission: true,
        drive: true,
        power: true,
        doors: true,
        seats: true,
        features: true,
        imageUrl: true,
        catalogItemId: true,
        modelYear: true,
        manufactureYear: true,
        currentMileage: true,
        condition: true,
        saleStatus: true,
        listPrice: true,
        stockSince: true,
        stockDealership: { select: { id: true, tradeName: true, city: true, state: true } },
        warrantyUntil: true,
        updatedAt: true,
        originDealership: { select: { tradeName: true, city: true, state: true } },
        ownerships: { where: { status: 'ACTIVE' }, take: 1, select: { startedAt: true, user: { select: { id: true, fullName: true, phone: true } } } },
        serviceOrders: { where: { status: 'COMPLETED' }, orderBy: { completedAt: 'desc' }, take: 1, select: { completedAt: true, mileage: true } },
      },
      orderBy: { updatedAt: 'desc' },
      take: 100,
    });
  }

  async findByVin(vin: string, actor: AuthenticatedUser) {
    const vehicle = await this.prisma.vehicle.findFirst({
      where: { vin: vin.toUpperCase(), ...vehicleScope(actor) },
      include: {
        originDealership: { select: { tradeName: true, city: true, state: true } },
        // O app mostra o detalhe de cada atendimento: sem a concessionária o
        // cliente não sabe onde o serviço foi feito.
        serviceOrders: {
          orderBy: { createdAt: 'desc' },
          take: 10,
          include: { dealership: { select: { tradeName: true, city: true, state: true } } },
        },
        ownerships: {
          where: { status: 'ACTIVE' },
          select: { id: true, status: true, startedAt: true, user: { select: { id: true, fullName: true, email: true, phone: true } } },
        },
      },
    });
    if (!vehicle) throw new NotFoundException('Veículo não encontrado.');
    if (actor.role === UserRole.CUSTOMER) {
      const linked = await this.prisma.vehicleOwnership.count({ where: { vehicleId: vehicle.id, userId: actor.userId, status: 'ACTIVE' } });
      if (!linked) throw new NotFoundException('Veículo não encontrado.');
    }
    return vehicle;
  }

  async create(input: CreateVehicleDto, actor: AuthenticatedUser) {
    const dealershipId = actor.role === UserRole.FORD_ADMIN
      ? input.stockDealershipId
      : actor.dealershipId;
    if (!dealershipId)
      throw new BadRequestException('Selecione a concessionária responsável pelo estoque.');
    const variant = await this.prisma.catalogItem.findUnique({
      where: { id: input.catalogItemId },
      include: { vehicleModel: true },
    });
    if (!variant)
      throw new NotFoundException('Modelo e versão não encontrados no catálogo.');
    if (!variant.version || !variant.modelYear)
      throw new BadRequestException('Complete versão e ano do modelo antes de cadastrar VINs.');
    const exteriorColor = variant.exteriorColor ?? input.exteriorColor?.trim();
    const interiorColor = variant.interiorColor ?? input.interiorColor?.trim();
    if (!exteriorColor || !interiorColor)
      throw new BadRequestException('Complete as cores da variação antes de cadastrar VINs.');
    if (input.exteriorColor && input.exteriorColor.trim() !== exteriorColor)
      throw new BadRequestException('A cor exterior não corresponde à variação selecionada.');
    if (input.interiorColor && input.interiorColor.trim() !== interiorColor)
      throw new BadRequestException('A cor interna não corresponde à variação selecionada.');
    try {
      const vehicle = await this.prisma.vehicle.create({
        data: {
          vin: input.vin.toUpperCase(),
          plate: input.plate?.toUpperCase() || null,
          catalogItemId: variant.id,
          model: variant.name.trim(),
          version: variant.version.trim(),
          exteriorColor,
          interiorColor,
          engine: variant.engine?.trim() || null,
          fuelType: variant.fuelType?.trim() || null,
          transmission: variant.transmission?.trim() || null,
          drive: variant.drive?.trim() || null,
          power: variant.power?.trim() || null,
          doors: variant.doors,
          seats: variant.seats,
          features: variant.highlights?.trim() || null,
          imageUrl: variant.imageUrl?.trim() || null,
          modelYear: variant.modelYear,
          manufactureYear: input.manufactureYear,
          currentMileage: input.currentMileage ?? 0,
          condition: input.condition,
          listPrice: input.listPrice ?? variant.vehicleModel.basePrice + variant.additionalPrice,
          saleStatus: VehicleSaleStatus.IN_STOCK,
          stockDealershipId: dealershipId,
          stockSince: new Date(),
          originDealershipId: input.condition === VehicleCondition.NEW ? dealershipId : null,
        },
      });
      await this.prisma.auditLog.create({ data: { performedById: actor.userId, action: 'VEHICLE_CREATE', entityType: 'Vehicle', entityId: vehicle.id, metadata: { vin: vehicle.vin, catalogItemId: variant.id } } });
      return vehicle;
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException('Já existe um veículo com este VIN ou placa.');
      }
      throw error;
    }
  }

  async createBatch(input: CreateVehicleBatchDto, actor: AuthenticatedUser) {
    const dealershipId = actor.role === UserRole.FORD_ADMIN ? input.stockDealershipId : actor.dealershipId;
    if (!dealershipId)
      throw new BadRequestException('Selecione a concessionária responsável pelo estoque.');
    const variant = await this.prisma.catalogItem.findUnique({
      where: { id: input.catalogItemId },
      include: { vehicleModel: true },
    });
    if (!variant) throw new NotFoundException('Variação não encontrada no catálogo.');
    if (!variant.version || !variant.modelYear || !variant.exteriorColor || !variant.interiorColor)
      throw new BadRequestException('Complete versão, ano e cores antes de cadastrar VINs.');

    const vins = input.vins.map((vin) => vin.trim().toUpperCase());
    const uniqueVins = [...new Set(vins)];
    if (uniqueVins.length !== vins.length)
      throw new BadRequestException('A lista contém VINs repetidos.');
    const existing = await this.prisma.vehicle.findMany({
      where: { vin: { in: uniqueVins } },
      select: { vin: true },
    });
    if (existing.length)
      throw new ConflictException(`VINs já cadastrados: ${existing.slice(0, 10).map((item) => item.vin).join(', ')}${existing.length > 10 ? '…' : ''}`);

    const listPrice = input.listPrice ?? variant.vehicleModel.basePrice + variant.additionalPrice;
    const now = new Date();
    try {
      const result = await this.prisma.$transaction(async (tx) => {
        const created = await tx.vehicle.createMany({
          data: uniqueVins.map((vin) => ({
            vin,
            catalogItemId: variant.id,
            model: variant.vehicleModel.name,
            version: variant.version,
            exteriorColor: variant.exteriorColor,
            interiorColor: variant.interiorColor,
            engine: variant.engine?.trim() || null,
            fuelType: variant.fuelType?.trim() || null,
            transmission: variant.transmission?.trim() || null,
            drive: variant.drive?.trim() || null,
            power: variant.power?.trim() || null,
            doors: variant.vehicleModel.doors,
            seats: variant.vehicleModel.seats,
            features: variant.highlights?.trim() || null,
            imageUrl: variant.imageUrl?.trim() || variant.vehicleModel.imageUrl?.trim() || null,
            modelYear: variant.vehicleModel.modelYear,
            manufactureYear: input.manufactureYear,
            currentMileage: input.currentMileage ?? 0,
            condition: input.condition,
            listPrice,
            saleStatus: VehicleSaleStatus.IN_STOCK,
            stockDealershipId: dealershipId,
            stockSince: now,
            originDealershipId: input.condition === VehicleCondition.NEW ? dealershipId : null,
          })),
        });
        await tx.auditLog.create({
          data: {
            performedById: actor.userId,
            action: 'VEHICLE_BATCH_CREATE',
            entityType: 'CatalogItem',
            entityId: variant.id,
            metadata: { catalogItemId: variant.id, count: created.count, firstVin: uniqueVins[0], dealershipId },
          },
        });
        return created;
      });
      return { created: result.count, variation: { id: variant.id, model: variant.vehicleModel.name, version: variant.version }, dealershipId };
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002')
        throw new ConflictException('Um ou mais VINs já foram cadastrados.');
      throw error;
    }
  }
}
