import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { Prisma, ServiceOrderStatus, UserRole } from "@prisma/client";
import { AuthenticatedUser } from "../auth/auth.types";
import { PrismaService } from "../prisma/prisma.service";
import { PilotImportDto, PilotServiceOrderRowDto, PilotVehicleRowDto } from "./dto/pilot-import.dto";

type ImportSummary = {
  sourceSystem: string;
  vehicles: { created: number; updated: number };
  serviceOrders: { created: number; updated: number };
};

@Injectable()
export class PilotImportService {
  constructor(private readonly prisma: PrismaService) {}

  async importBatch(input: PilotImportDto, actor: AuthenticatedUser): Promise<ImportSummary> {
    if (!input.vehicles.length && !input.serviceOrders.length) {
      throw new BadRequestException("O lote precisa conter veículos ou ordens de serviço.");
    }
    const externalIds = new Set<string>();
    for (const row of [...input.vehicles, ...input.serviceOrders]) {
      const key = `${row.constructor.name}:${row.externalId}`;
      if (externalIds.has(key)) throw new BadRequestException(`externalId duplicado no lote: ${row.externalId}.`);
      externalIds.add(key);
    }

    return this.prisma.$transaction(async (tx) => {
      const summary: ImportSummary = {
        sourceSystem: input.sourceSystem,
        vehicles: { created: 0, updated: 0 },
        serviceOrders: { created: 0, updated: 0 },
      };
      const vehiclesByVin = new Map<string, { id: string; currentMileage: number; originDealershipId: string | null }>();

      for (const row of input.vehicles) {
        const vin = normalizeVin(row.vin);
        const dealershipId = await this.resolveDealership(tx, row.dealershipId, actor, "o veículo");
        const existingByExternal = await tx.vehicle.findUnique({
          where: { sourceSystem_externalId: { sourceSystem: input.sourceSystem, externalId: row.externalId } },
        });
        const existingByVin = await tx.vehicle.findUnique({ where: { vin } });
        if (existingByExternal && existingByExternal.vin !== vin) {
          throw new ConflictException(`A origem ${input.sourceSystem} mudou o VIN do registro ${row.externalId}.`);
        }
        if (existingByExternal && existingByVin && existingByExternal.id !== existingByVin.id) {
          throw new ConflictException(`O VIN ${vin} já está associado a outro registro de origem.`);
        }
        const existing = existingByExternal ?? existingByVin;
        if (existing) await this.assertVehicleAccess(tx, existing.id, actor);
        const currentMileage = row.currentMileage === undefined
          ? existing?.currentMileage ?? 0
          : Math.max(existing?.currentMileage ?? 0, row.currentMileage);
        const data = {
          vin,
          plate: row.plate?.toUpperCase(),
          model: row.model,
          modelYear: row.modelYear,
          manufactureYear: row.manufactureYear,
          currentMileage,
          warrantyUntil: row.warrantyUntil ? new Date(row.warrantyUntil) : undefined,
          sourceSystem: input.sourceSystem,
          externalId: row.externalId,
          ...(existing ? {} : { originDealershipId: dealershipId }),
        };
        const vehicle = existing
          ? await tx.vehicle.update({ where: { id: existing.id }, data })
          : await tx.vehicle.create({ data });
        vehiclesByVin.set(vin, { id: vehicle.id, currentMileage: vehicle.currentMileage, originDealershipId: vehicle.originDealershipId });
        summary.vehicles[existing ? "updated" : "created"] += 1;
      }

      for (const row of input.serviceOrders) {
        const vin = normalizeVin(row.vin);
        const vehicle = vehiclesByVin.get(vin) ?? await tx.vehicle.findUnique({ where: { vin }, select: { id: true, currentMileage: true, originDealershipId: true } });
        if (!vehicle) throw new NotFoundException(`Veículo ${vin} não encontrado para a ordem ${row.externalId}.`);
        await this.assertVehicleAccess(tx, vehicle.id, actor, true);
        const dealershipId = await this.resolveDealership(tx, row.dealershipId ?? vehicle.originDealershipId ?? undefined, actor, "a ordem de serviço");
        const existing = await tx.serviceOrder.findUnique({
          where: { sourceSystem_externalId: { sourceSystem: input.sourceSystem, externalId: row.externalId } },
        });
        if (existing && existing.vehicleId !== vehicle.id) {
          throw new ConflictException(`A ordem ${row.externalId} já está associada a outro veículo.`);
        }
        const status = row.status ?? (row.completedAt ? ServiceOrderStatus.COMPLETED : existing?.status ?? ServiceOrderStatus.OPEN);
        if (existing?.status === ServiceOrderStatus.COMPLETED && status !== ServiceOrderStatus.COMPLETED) {
          throw new ConflictException(`A ordem ${row.externalId} já foi concluída e não pode ser reaberta por importação.`);
        }
        const completedAt = status === ServiceOrderStatus.COMPLETED
          ? row.completedAt ? new Date(row.completedAt) : existing?.completedAt ?? new Date()
          : null;
        const data = {
          vehicleId: vehicle.id,
          dealershipId,
          mileage: row.mileage,
          status,
          description: row.description,
          amount: row.amount,
          completedAt,
          sourceSystem: input.sourceSystem,
          externalId: row.externalId,
        };
        const order = existing
          ? await tx.serviceOrder.update({ where: { id: existing.id }, data })
          : await tx.serviceOrder.create({ data });
        if (status === ServiceOrderStatus.COMPLETED) {
          await tx.campaignTarget.updateMany({
            where: { vehicleId: vehicle.id, sentAt: { not: null }, convertedAt: null },
            data: { convertedAt: completedAt ?? new Date() },
          });
        }
        if (row.mileage > vehicle.currentMileage) {
          await tx.vehicle.update({ where: { id: vehicle.id }, data: { currentMileage: row.mileage } });
        }
        summary.serviceOrders[existing ? "updated" : "created"] += 1;
        void order;
      }

      await tx.auditLog.create({
        data: {
          performedById: actor.userId,
          action: "PILOT_IMPORT",
          entityType: "IntegrationBatch",
          entityId: `${input.sourceSystem}:${new Date().toISOString()}`.slice(0, 36),
          metadata: summary as unknown as Prisma.InputJsonValue,
        },
      });
      return summary;
    });
  }

  private async resolveDealership(tx: Prisma.TransactionClient, requested: string | undefined, actor: AuthenticatedUser, subject: string) {
    const dealershipId = actor.role === UserRole.FORD_ADMIN ? requested : actor.dealershipId;
    if (!dealershipId) throw new BadRequestException(`Informe a concessionária para ${subject}.`);
    if (actor.role !== UserRole.FORD_ADMIN && requested && requested !== actor.dealershipId) {
      throw new ForbiddenException(`Você só pode importar dados da própria concessionária.`);
    }
    const dealership = await tx.dealership.findUnique({ where: { id: dealershipId }, select: { id: true } });
    if (!dealership) throw new NotFoundException(`Concessionária ${dealershipId} não encontrada.`);
    return dealership.id;
  }

  private async assertVehicleAccess(tx: Prisma.TransactionClient, vehicleId: string, actor: AuthenticatedUser, allowServiceVisit = false) {
    if (actor.role === UserRole.FORD_ADMIN) return;
    if (!actor.dealershipId) throw new ForbiddenException("Usuário sem concessionária vinculada.");
    const vehicle = await tx.vehicle.findFirst({
      where: {
        id: vehicleId,
        OR: [
          { originDealershipId: actor.dealershipId },
          ...(allowServiceVisit ? [{ serviceOrders: { some: { dealershipId: actor.dealershipId } } }] : []),
        ],
      },
      select: { id: true },
    });
    if (!vehicle) throw new ForbiddenException("O veículo não pertence ao escopo da concessionária.");
  }
}

function normalizeVin(vin: string) {
  return vin.trim().toUpperCase();
}
