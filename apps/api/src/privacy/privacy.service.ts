import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { ConsentPurpose, DataRequestStatus } from "@prisma/client";
import { AuthenticatedUser } from "../auth/auth.types";
import { PrismaService } from "../prisma/prisma.service";
import { CreateDataRequestDto } from "./dto/create-data-request.dto";
import { UpdateConsentDto } from "./dto/update-consent.dto";
import { UpdateDataRequestDto } from "./dto/update-data-request.dto";

/** Texto enviado ao titular: nenhum enum interno chega à notificação. */
const DATA_REQUEST_STATUS_LABELS: Record<DataRequestStatus, string> = {
  RECEIVED: "recebida e aguardando triagem",
  IN_REVIEW: "em análise pela equipe de privacidade",
  COMPLETED: "concluída",
  REJECTED: "indeferida — consulte a justificativa registrada",
};

@Injectable()
export class PrivacyService {
  constructor(private readonly prisma: PrismaService) {}

  async me(actor: AuthenticatedUser) {
    const [stored, requests] = await Promise.all([
      this.prisma.userConsent.findMany({ where: { userId: actor.userId } }),
      this.prisma.dataSubjectRequest.findMany({
        where: { requestedById: actor.userId },
        orderBy: { createdAt: "desc" },
        take: 20,
      }),
    ]);
    const consents = Object.values(ConsentPurpose).map(
      (purpose) =>
        stored.find((item) => item.purpose === purpose) ?? {
          id: null,
          userId: actor.userId,
          purpose,
          granted: false,
          source: null,
          grantedAt: null,
          revokedAt: null,
          updatedAt: null,
        },
    );
    return { consents, requests };
  }

  async updateConsent(
    purpose: ConsentPurpose,
    input: UpdateConsentDto,
    actor: AuthenticatedUser,
  ) {
    if (!Object.values(ConsentPurpose).includes(purpose))
      throw new BadRequestException("Finalidade de consentimento inválida.");
    const now = new Date();
    return this.prisma.$transaction(async (tx) => {
      const consent = await tx.userConsent.upsert({
        where: { userId_purpose: { userId: actor.userId, purpose } },
        update: {
          granted: input.granted,
          source: input.source ?? "WEB",
          grantedAt: input.granted ? now : undefined,
          revokedAt: input.granted ? null : now,
        },
        create: {
          userId: actor.userId,
          purpose,
          granted: input.granted,
          source: input.source ?? "WEB",
          grantedAt: input.granted ? now : null,
          revokedAt: input.granted ? null : now,
        },
      });
      await tx.auditLog.create({
        data: {
          performedById: actor.userId,
          action: input.granted ? "CONSENT_GRANT" : "CONSENT_REVOKE",
          entityType: "UserConsent",
          entityId: consent.id,
          metadata: { purpose, source: consent.source },
        },
      });
      return consent;
    });
  }

  async createRequest(input: CreateDataRequestDto, actor: AuthenticatedUser) {
    const open = await this.prisma.dataSubjectRequest.count({
      where: {
        requestedById: actor.userId,
        type: input.type,
        status: {
          in: [DataRequestStatus.RECEIVED, DataRequestStatus.IN_REVIEW],
        },
      },
    });
    if (open)
      throw new BadRequestException(
        "Já existe uma solicitação deste tipo em andamento.",
      );
    return this.prisma.$transaction(async (tx) => {
      const request = await tx.dataSubjectRequest.create({
        data: {
          requestedById: actor.userId,
          type: input.type,
          notes: input.notes,
        },
      });
      await tx.auditLog.create({
        data: {
          performedById: actor.userId,
          action: "DATA_REQUEST_CREATE",
          entityType: "DataSubjectRequest",
          entityId: request.id,
          metadata: { type: input.type },
        },
      });
      return request;
    });
  }

  listRequests() {
    return this.prisma.dataSubjectRequest.findMany({
      include: {
        requestedBy: {
          select: { id: true, fullName: true, email: true, phone: true },
        },
        handledBy: { select: { id: true, fullName: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 200,
    });
  }

  async updateRequest(
    id: string,
    input: UpdateDataRequestDto,
    actor: AuthenticatedUser,
  ) {
    const current = await this.prisma.dataSubjectRequest.findUnique({
      where: { id },
    });
    if (!current) throw new NotFoundException("Solicitação não encontrada.");
    const completed =
      input.status === DataRequestStatus.COMPLETED ||
      input.status === DataRequestStatus.REJECTED;
    return this.prisma.$transaction(async (tx) => {
      const request = await tx.dataSubjectRequest.update({
        where: { id },
        data: {
          status: input.status,
          resolution: input.resolution,
          handledById: actor.userId,
          completedAt: completed ? new Date() : null,
        },
      });
      await tx.notification.create({
        data: {
          userId: current.requestedById,
          type: "SYSTEM",
          title: "Solicitação de privacidade atualizada",
          message: `Sua solicitação está ${DATA_REQUEST_STATUS_LABELS[input.status]}.`,
          link: "/configuracoes",
        },
      });
      await tx.auditLog.create({
        data: {
          performedById: actor.userId,
          action: "DATA_REQUEST_UPDATE",
          entityType: "DataSubjectRequest",
          entityId: id,
          metadata: { fromStatus: current.status, toStatus: input.status },
        },
      });
      return request;
    });
  }

  async exportData(actor: AuthenticatedUser) {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: actor.userId },
      select: {
        id: true,
        email: true,
        fullName: true,
        phone: true,
        role: true,
        createdAt: true,
        updatedAt: true,
        dealership: { select: { tradeName: true, city: true, state: true } },
        ownerships: {
          select: {
            status: true,
            startedAt: true,
            endedAt: true,
            vehicle: {
              select: {
                vin: true,
                plate: true,
                model: true,
                modelYear: true,
                currentMileage: true,
              },
            },
          },
        },
        bookings: {
          select: {
            requestedFor: true,
            status: true,
            notes: true,
            vehicle: { select: { vin: true, model: true } },
            dealership: { select: { tradeName: true } },
          },
        },
        loyalty: {
          select: { balance: true, transactions: true, vouchers: true },
        },
        consents: true,
        dataRequests: true,
      },
    });
    await this.prisma.auditLog.create({
      data: {
        performedById: actor.userId,
        action: "DATA_EXPORT",
        entityType: "User",
        entityId: actor.userId,
      },
    });
    return {
      generatedAt: new Date(),
      format: "LGPD_PORTABILITY_JSON",
      data: user,
    };
  }
}
