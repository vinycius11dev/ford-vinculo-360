import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  NotificationType,
  RepurchaseLeadStatus,
  UserRole,
} from "@prisma/client";
import { AuthenticatedUser } from "../auth/auth.types";
import { PrismaService } from "../prisma/prisma.service";
import { CreateRepurchaseLeadDto } from "./dto/create-repurchase-lead.dto";
import { ExpressRepurchaseInterestDto } from "./dto/express-repurchase-interest.dto";
import { UpdateRepurchaseLeadDto } from "./dto/update-repurchase-lead.dto";

const leadInclude = {
  vehicle: {
    select: {
      vin: true,
      plate: true,
      model: true,
      modelYear: true,
      currentMileage: true,
      imageUrl: true,
    },
  },
  owner: { select: { id: true, fullName: true, email: true, phone: true } },
  dealership: {
    select: { id: true, tradeName: true, city: true, state: true },
  },
  createdBy: { select: { id: true, fullName: true } },
  events: {
    include: { performedBy: { select: { id: true, fullName: true } } },
    orderBy: { createdAt: "desc" as const },
  },
};

const REPURCHASE_STAFF_ROLES = [
  UserRole.DEALERSHIP_AGENT,
  UserRole.DEALERSHIP_MANAGER,
  UserRole.FORD_ADMIN,
];

@Injectable()
export class RepurchaseLeadsService {
  constructor(private readonly prisma: PrismaService) {}

  async expressInterest(
    input: ExpressRepurchaseInterestDto,
    actor: AuthenticatedUser,
  ) {
    const customer = await this.prisma.user.findUnique({
      where: { id: actor.userId },
      select: {
        id: true,
        fullName: true,
        email: true,
        registeredByDealershipId: true,
      },
    });
    if (!customer) throw new NotFoundException("Cliente não encontrado.");

    const vehicle = await this.prisma.vehicle.findFirst({
      where: {
        vin: input.vin.trim().toUpperCase(),
        ownerships: { some: { userId: actor.userId, status: "ACTIVE" } },
      },
      include: {
        serviceOrders: {
          orderBy: { createdAt: "desc" },
          take: 1,
          select: { dealershipId: true },
        },
      },
    });
    if (!vehicle)
      throw new NotFoundException(
        "Este veículo não está vinculado à sua conta.",
      );

    const dealershipId =
      customer.registeredByDealershipId ??
      vehicle.serviceOrders[0]?.dealershipId ??
      vehicle.originDealershipId;
    if (!dealershipId)
      throw new BadRequestException(
        "Não encontramos uma concessionária responsável pelo atendimento.",
      );

    const desiredModel = input.desiredModel?.trim() || "um novo Ford";
    const age = Math.max(0, new Date().getFullYear() - vehicle.modelYear);
    const estimatedValue = Math.max(
      35000,
      Math.round(
        (220000 - age * 22000 - vehicle.currentMileage * 0.45) / 1000,
      ) * 1000,
    );
    const notes = `Interesse declarado pelo cliente no app. Modelo desejado: ${desiredModel}. O ${vehicle.model} ${vehicle.modelYear} pode entrar como usado na negociação.`;

    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.repurchaseLead.findUnique({
        where: {
          vehicleId_dealershipId: { vehicleId: vehicle.id, dealershipId },
        },
      });
      const nextStatus =
        existing &&
        existing.status !== RepurchaseLeadStatus.WON &&
        existing.status !== RepurchaseLeadStatus.LOST
          ? existing.status
          : RepurchaseLeadStatus.NEW;

      const lead = existing
        ? await tx.repurchaseLead.update({
            where: { id: existing.id },
            data: {
              ownerId: customer.id,
              score: 99,
              estimatedValue,
              status: nextStatus,
              notes,
              closedAt: nextStatus === RepurchaseLeadStatus.NEW ? null : undefined,
              events: {
                create: {
                  performedById: actor.userId,
                  fromStatus: existing.status,
                  toStatus: nextStatus,
                  notes,
                },
              },
            },
            include: leadInclude,
          })
        : await tx.repurchaseLead.create({
            data: {
              vehicleId: vehicle.id,
              ownerId: customer.id,
              dealershipId,
              createdById: actor.userId,
              score: 99,
              estimatedValue,
              notes,
              events: {
                create: {
                  performedById: actor.userId,
                  toStatus: RepurchaseLeadStatus.NEW,
                  notes,
                },
              },
            },
            include: leadInclude,
          });

      const recipients = await tx.user.findMany({
        where: {
          active: true,
          role: { in: REPURCHASE_STAFF_ROLES },
        },
        select: { id: true },
      });
      if (recipients.length)
        await tx.notification.createMany({
          data: recipients.map(({ id }) => ({
            userId: id,
            type: NotificationType.SYSTEM,
            title: "Cliente quer trocar de carro",
            message: `${customer.fullName} demonstrou interesse em ${desiredModel}. O ${vehicle.model} ${vehicle.modelYear} pode entrar na negociação. Origem: ${lead.dealership.tradeName}.`,
            link: `/recompra?lead=${lead.id}`,
          })),
        });

      await tx.auditLog.create({
        data: {
          performedById: actor.userId,
          action: "CUSTOMER_REPURCHASE_INTEREST",
          entityType: "RepurchaseLead",
          entityId: lead.id,
          metadata: {
            vin: vehicle.vin,
            desiredModel,
            dealershipId,
            recipients: recipients.length,
          },
        },
      });
      return {
        leadId: lead.id,
        desiredModel,
        dealership: lead.dealership,
        message: "Interesse enviado para a equipe Ford.",
      };
    });
  }

  list(_actor: AuthenticatedUser) {
    return this.prisma.repurchaseLead.findMany({
      include: leadInclude,
      orderBy: { updatedAt: "desc" },
      take: 200,
    });
  }

  async create(input: CreateRepurchaseLeadDto, actor: AuthenticatedUser) {
    const dealershipId =
      actor.role === UserRole.FORD_ADMIN
        ? input.dealershipId
        : actor.dealershipId;
    if (!dealershipId)
      throw new BadRequestException(
        "Informe a concessionária responsável pelo lead.",
      );

    const dealership = await this.prisma.dealership.findUnique({
      where: { id: dealershipId },
      select: { id: true },
    });
    if (!dealership)
      throw new NotFoundException("Concessionária não encontrada.");

    const vehicle = await this.prisma.vehicle.findUnique({
      where: { vin: input.vin.toUpperCase() },
      include: {
        ownerships: {
          where: { status: "ACTIVE" },
          orderBy: { startedAt: "desc" },
          take: 1,
        },
      },
    });
    if (!vehicle) throw new NotFoundException("Veículo não encontrado.");
    if (actor.role !== UserRole.FORD_ADMIN) {
      const accessible =
        vehicle.originDealershipId === dealershipId ||
        (await this.prisma.serviceOrder.count({
          where: { vehicleId: vehicle.id, dealershipId },
        }));
      if (!accessible)
        throw new ForbiddenException(
          "Este veículo está fora do acesso da sua concessionária.",
        );
    }

    const existing = await this.prisma.repurchaseLead.findUnique({
      where: {
        vehicleId_dealershipId: { vehicleId: vehicle.id, dealershipId },
      },
    });
    if (existing)
      throw new ConflictException(
        "Já existe um lead de recompra para este veículo nesta concessionária.",
      );

    return this.prisma.$transaction(async (tx) => {
      const lead = await tx.repurchaseLead.create({
        data: {
          vehicleId: vehicle.id,
          ownerId: vehicle.ownerships[0]?.userId,
          dealershipId,
          createdById: actor.userId,
          score: input.score,
          estimatedValue: input.estimatedValue,
          notes: input.notes,
          events: {
            create: {
              performedById: actor.userId,
              toStatus: RepurchaseLeadStatus.NEW,
              notes:
                input.notes ??
                "Lead criado a partir da oportunidade de recompra.",
            },
          },
        },
        include: leadInclude,
      });
      await tx.auditLog.create({
        data: {
          performedById: actor.userId,
          action: "REPURCHASE_LEAD_CREATE",
          entityType: "RepurchaseLead",
          entityId: lead.id,
          metadata: { vin: vehicle.vin, dealershipId, score: input.score },
        },
      });
      return lead;
    });
  }

  async update(
    id: string,
    input: UpdateRepurchaseLeadDto,
    actor: AuthenticatedUser,
  ) {
    const current = await this.prisma.repurchaseLead.findFirst({
      where: { id },
    });
    if (!current) throw new NotFoundException("Lead não encontrado.");
    if (input.status === undefined && input.notes === undefined)
      throw new BadRequestException("Informe ao menos uma alteração.");

    const nextStatus = input.status ?? current.status;
    const now = new Date();
    const closing =
      nextStatus === RepurchaseLeadStatus.WON ||
      nextStatus === RepurchaseLeadStatus.LOST;
    return this.prisma.$transaction(async (tx) => {
      const lead = await tx.repurchaseLead.update({
        where: { id },
        data: {
          status: nextStatus,
          notes: input.notes === undefined ? undefined : input.notes,
          contactedAt:
            nextStatus === RepurchaseLeadStatus.CONTACTED &&
            !current.contactedAt
              ? now
              : undefined,
          closedAt: closing ? (current.closedAt ?? now) : null,
          events: {
            create: {
              performedById: actor.userId,
              fromStatus: current.status,
              toStatus: nextStatus,
              notes: input.notes,
            },
          },
        },
        include: leadInclude,
      });
      await tx.auditLog.create({
        data: {
          performedById: actor.userId,
          action: "REPURCHASE_LEAD_UPDATE",
          entityType: "RepurchaseLead",
          entityId: id,
          metadata: { fromStatus: current.status, toStatus: nextStatus },
        },
      });
      return lead;
    });
  }
}
