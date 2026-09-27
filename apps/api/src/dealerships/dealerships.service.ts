import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { UserRole } from "@prisma/client";
import { AuthenticatedUser } from "../auth/auth.types";
import { PrismaService } from "../prisma/prisma.service";
import { CreateDealershipDto } from "./dto/create-dealership.dto";
import { UpdateDealershipDto } from "./dto/update-dealership.dto";

@Injectable()
export class DealershipsService {
  constructor(private readonly prisma: PrismaService) {}
  async list() {
    const dealerships = await this.prisma.dealership.findMany({
      select: {
        id: true,
        tradeName: true,
        legalName: true,
        city: true,
        state: true,
        timezone: true,
        businessDays: true,
        openingTime: true,
        closingTime: true,
        slotDurationMinutes: true,
        simultaneousCapacity: true,
        _count: {
          select: { staff: true, serviceOrders: true, vehiclesSold: true },
        },
      },
      orderBy: { tradeName: "asc" },
    });
    return dealerships.map((dealership) => ({
      ...dealership,
      businessDays: dealership.businessDays
        .split(",")
        .map(Number)
        .filter((day) => Number.isInteger(day)),
    }));
  }
  create(input: CreateDealershipDto) {
    return this.prisma.dealership.create({
      data: { ...input, state: input.state.toUpperCase() },
    });
  }
  async update(
    id: string,
    input: UpdateDealershipDto,
    actor: AuthenticatedUser,
  ) {
    if (actor.role !== UserRole.FORD_ADMIN && actor.dealershipId !== id)
      throw new ForbiddenException(
        "Você só pode editar a própria concessionária.",
      );
    const current = await this.prisma.dealership.findUnique({ where: { id } });
    if (!current)
      throw new NotFoundException("Concessionária não encontrada.");
    const openingTime = input.openingTime ?? current.openingTime;
    const closingTime = input.closingTime ?? current.closingTime;
    if (openingTime >= closingTime)
      throw new BadRequestException(
        "O horário de fechamento deve ser posterior à abertura.",
      );
    if (input.timezone) {
      try {
        new Intl.DateTimeFormat("pt-BR", { timeZone: input.timezone }).format();
      } catch {
        throw new BadRequestException("Fuso horário inválido.");
      }
    }
    return this.prisma.$transaction(async (tx) => {
      const dealership = await tx.dealership.update({
        where: { id },
        data: {
          legalName: input.legalName,
          tradeName: input.tradeName,
          city: input.city,
          state: input.state?.toUpperCase(),
          timezone: input.timezone,
          businessDays: input.businessDays?.sort((a, b) => a - b).join(","),
          openingTime: input.openingTime,
          closingTime: input.closingTime,
          slotDurationMinutes: input.slotDurationMinutes,
          simultaneousCapacity: input.simultaneousCapacity,
        },
      });
      await tx.auditLog.create({
        data: {
          performedById: actor.userId,
          action: "DEALERSHIP_UPDATE",
          entityType: "Dealership",
          entityId: id,
        },
      });
      return {
        ...dealership,
        businessDays: dealership.businessDays.split(",").map(Number),
      };
    });
  }
}
