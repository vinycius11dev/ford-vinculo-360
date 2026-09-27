import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { Prisma, RecallTargetStatus, UserRole } from "@prisma/client";
import { AuthenticatedUser } from "../auth/auth.types";
import { PrismaService } from "../prisma/prisma.service";
import { CreateRecallDto } from "./dto/create-recall.dto";
import { UpdateRecallTargetDto } from "./dto/update-recall-target.dto";

const vehicleAccess = (actor: AuthenticatedUser): Prisma.VehicleWhereInput =>
  actor.role === UserRole.FORD_ADMIN
    ? {}
    : actor.role === UserRole.CUSTOMER
      ? { ownerships: { some: { userId: actor.userId, status: "ACTIVE" } } }
      : {
          OR: [
            { originDealershipId: actor.dealershipId ?? "__none__" },
            {
              serviceOrders: {
                some: { dealershipId: actor.dealershipId ?? "__none__" },
              },
            },
          ],
        };

@Injectable()
export class RecallsService {
  constructor(private readonly prisma: PrismaService) {}

  list(actor: AuthenticatedUser) {
    const access = vehicleAccess(actor);
    return this.prisma.recall.findMany({
      where: { targets: { some: { vehicle: access } } },
      include: {
        targets: {
          where: { vehicle: access },
          include: {
            vehicle: {
              include: {
                ownerships: {
                  where: { status: "ACTIVE" },
                  take: 1,
                  select: {
                    user: {
                      select: {
                        id: true,
                        fullName: true,
                        email: true,
                        phone: true,
                      },
                    },
                  },
                },
              },
            },
          },
          orderBy: { createdAt: "desc" },
        },
      },
      orderBy: [{ active: "desc" }, { startsAt: "desc" }],
      take: 100,
    });
  }

  async create(input: CreateRecallDto, actor: AuthenticatedUser) {
    const code = input.code.trim().toUpperCase();
    if (await this.prisma.recall.count({ where: { code } }))
      throw new ConflictException("Já existe um recall com este código.");
    const vins = [
      ...new Set(
        input.vehicleVins
          .map((vin) => vin.trim().toUpperCase())
          .filter(Boolean),
      ),
    ];
    const vehicles = await this.prisma.vehicle.findMany({
      where: { vin: { in: vins }, ...vehicleAccess(actor) },
      select: { id: true, vin: true },
    });
    if (vehicles.length !== vins.length)
      throw new NotFoundException(
        "Um ou mais VINs não existem ou estão fora do seu acesso.",
      );
    return this.prisma.$transaction(async (tx) => {
      const recall = await tx.recall.create({
        data: {
          code,
          title: input.title,
          description: input.description,
          severity: input.severity,
          startsAt: new Date(input.startsAt),
          targets: {
            create: vehicles.map((vehicle) => ({ vehicleId: vehicle.id })),
          },
        },
        include: { targets: { include: { vehicle: true } } },
      });
      await tx.auditLog.create({
        data: {
          performedById: actor.userId,
          action: "RECALL_CREATE",
          entityType: "Recall",
          entityId: recall.id,
          metadata: { code, targets: vehicles.length },
        },
      });
      return recall;
    });
  }

  async notify(id: string, actor: AuthenticatedUser) {
    const recall = await this.prisma.recall.findFirst({
      where: { id, targets: { some: { vehicle: vehicleAccess(actor) } } },
      include: {
        targets: {
          where: { notifiedAt: null, vehicle: vehicleAccess(actor) },
          include: {
            vehicle: {
              include: { ownerships: { where: { status: "ACTIVE" }, take: 1 } },
            },
          },
        },
      },
    });
    if (!recall) throw new NotFoundException("Recall não encontrado.");
    const recipients = recall.targets.flatMap((target) =>
      target.vehicle.ownerships[0]?.userId
        ? [
            {
              targetId: target.id,
              userId: target.vehicle.ownerships[0].userId,
              vin: target.vehicle.vin,
            },
          ]
        : [],
    );
    if (!recipients.length)
      throw new BadRequestException(
        "Nenhum proprietário pendente para notificar.",
      );
    const now = new Date();
    await this.prisma.$transaction(async (tx) => {
      for (const recipient of recipients) {
        await tx.notification.create({
          data: {
            userId: recipient.userId,
            type: "RECALL",
            title: `Recall ${recall.code}`,
            message: recall.title,
            link: "/seguranca",
          },
        });
        await tx.recallTarget.update({
          where: { id: recipient.targetId },
          data: { notifiedAt: now, status: RecallTargetStatus.CONTACTED },
        });
      }
      await tx.auditLog.create({
        data: {
          performedById: actor.userId,
          action: "RECALL_NOTIFY",
          entityType: "Recall",
          entityId: id,
          metadata: { recipients: recipients.length },
        },
      });
    });
    return { recallId: id, notified: recipients.length, notifiedAt: now };
  }

  async updateTarget(
    targetId: string,
    input: UpdateRecallTargetDto,
    actor: AuthenticatedUser,
  ) {
    const target = await this.prisma.recallTarget.findFirst({
      where: { id: targetId, vehicle: vehicleAccess(actor) },
    });
    if (!target)
      throw new NotFoundException("Veículo do recall não encontrado.");
    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.recallTarget.update({
        where: { id: targetId },
        data: {
          status: input.status,
          completedAt:
            input.status === RecallTargetStatus.COMPLETED ? new Date() : null,
        },
        include: { vehicle: true, recall: true },
      });
      await tx.auditLog.create({
        data: {
          performedById: actor.userId,
          action: "RECALL_TARGET_UPDATE",
          entityType: "RecallTarget",
          entityId: targetId,
          metadata: { fromStatus: target.status, toStatus: input.status },
        },
      });
      return updated;
    });
  }
}
