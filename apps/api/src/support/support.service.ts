import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  MessageChannel,
  MessageStatus,
  OwnershipStatus,
  Prisma,
  SupportTicketStatus,
  UserRole,
} from "@prisma/client";
import { ConfigService } from "@nestjs/config";
import { createHash, randomBytes } from "node:crypto";
import { AuthenticatedUser } from "../auth/auth.types";
import { MessagingService } from "../messaging/messaging.service";
import { PrismaService } from "../prisma/prisma.service";
import { CreateSupportTicketDto } from "./dto/create-support-ticket.dto";
import { CreateSupportMessageDto } from "./dto/create-support-message.dto";
import { UpdateSupportTicketDto } from "./dto/update-support-ticket.dto";
import { ResolveVehicleValidationDto } from "./dto/resolve-vehicle-validation.dto";

@Injectable()
export class SupportService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly messaging: MessagingService,
    private readonly config: ConfigService,
  ) {}

  private access(actor: AuthenticatedUser): Prisma.SupportTicketWhereInput {
    if (actor.role === UserRole.FORD_ADMIN) return {};
    if (actor.role === UserRole.CUSTOMER) return { requesterId: actor.userId };
    return { dealershipId: actor.dealershipId ?? "__none__" };
  }

  async list(actor: AuthenticatedUser) {
    const tickets = await this.prisma.supportTicket.findMany({
      where: this.access(actor),
      include: {
        requester: { select: { id: true, fullName: true, email: true } },
        dealership: { select: { id: true, tradeName: true } },
        assignedTo: { select: { id: true, fullName: true } },
        messages: {
          where: { senderId: { not: actor.userId }, readAt: null },
          select: { id: true },
        },
        _count: { select: { messages: true } },
      },
      orderBy: [{ status: "asc" }, { createdAt: "desc" }],
      take: 200,
    });
    return tickets.map(({ messages, _count, ...ticket }) => ({
      ...ticket,
      unreadCount: messages.length,
      messageCount: _count.messages,
    }));
  }

  async create(input: CreateSupportTicketDto, actor: AuthenticatedUser) {
    const requester = await this.prisma.user.findUnique({
      where: { id: actor.userId },
      select: {
        dealershipId: true,
        registeredByDealershipId: true,
        ownerships: {
          where: { status: OwnershipStatus.ACTIVE },
          orderBy: { startedAt: "desc" },
          take: 1,
          select: { vehicle: { select: { originDealershipId: true } } },
        },
      },
    });
    const dealershipId =
      requester?.dealershipId ??
      requester?.registeredByDealershipId ??
      requester?.ownerships[0]?.vehicle.originDealershipId ??
      null;
    return this.prisma.$transaction(async (tx) => {
      const ticket = await tx.supportTicket.create({
        data: {
          requesterId: actor.userId,
          dealershipId,
          subject: input.subject.trim(),
          message: input.message.trim(),
          category: input.category,
          priority: input.priority,
          messages: {
            create: { senderId: actor.userId, body: input.message.trim() },
          },
        },
        include: {
          requester: { select: { id: true, fullName: true, email: true } },
          dealership: { select: { id: true, tradeName: true } },
          assignedTo: { select: { id: true, fullName: true } },
        },
      });
      const recipients = await tx.user.findMany({
        where: {
          active: true,
          OR: [
            { role: UserRole.FORD_ADMIN },
            ...(dealershipId
              ? [
                  {
                    role: {
                      in: [
                        UserRole.DEALERSHIP_AGENT,
                        UserRole.DEALERSHIP_MANAGER,
                      ],
                    },
                    dealershipId,
                  } as Prisma.UserWhereInput,
                ]
              : []),
          ],
        },
        select: { id: true },
      });
      if (recipients.length)
        await tx.notification.createMany({
          data: recipients.map(({ id }) => ({
            userId: id,
            type: "SYSTEM",
            title: ticket.subject.startsWith(
              "Validação de veículo informado pelo cliente",
            )
              ? "Novo veículo aguardando validação"
              : "Nova mensagem de cliente",
            message: `${ticket.requester.fullName}: ${ticket.subject}`,
            link: ticket.subject.startsWith(
              "Validação de veículo informado pelo cliente",
            )
              ? `/validacoes?ticket=${ticket.id}`
              : `/atendimentos?ticket=${ticket.id}`,
          })),
        });
      await tx.auditLog.create({
        data: {
          performedById: actor.userId,
          action: "SUPPORT_TICKET_CREATE",
          entityType: "SupportTicket",
          entityId: ticket.id,
          metadata: { category: ticket.category, priority: ticket.priority },
        },
      });
      return ticket;
    });
  }

  private async accessibleTicket(id: string, actor: AuthenticatedUser) {
    const ticket = await this.prisma.supportTicket.findFirst({
      where: { id, ...this.access(actor) },
      include: {
        requester: { select: { id: true, fullName: true, email: true } },
        dealership: { select: { id: true, tradeName: true } },
        assignedTo: { select: { id: true, fullName: true } },
      },
    });
    if (!ticket) throw new NotFoundException("Conversa não encontrada.");
    return ticket;
  }

  async messages(id: string, actor: AuthenticatedUser) {
    await this.accessibleTicket(id, actor);
    return this.prisma.supportMessage.findMany({
      where: { ticketId: id },
      include: {
        sender: { select: { id: true, fullName: true, role: true } },
      },
      orderBy: { createdAt: "asc" },
      take: 300,
    });
  }

  async markMessagesRead(id: string, actor: AuthenticatedUser) {
    await this.accessibleTicket(id, actor);
    const result = await this.prisma.supportMessage.updateMany({
      where: {
        ticketId: id,
        senderId: { not: actor.userId },
        readAt: null,
      },
      data: { readAt: new Date() },
    });
    return { read: result.count };
  }

  async sendMessage(
    id: string,
    input: CreateSupportMessageDto,
    actor: AuthenticatedUser,
  ) {
    const ticket = await this.accessibleTicket(id, actor);
    // A conta de quem aguarda validação está bloqueada: não há com quem conversar.
    if (ticket.subject.startsWith("Validação de veículo informado pelo cliente"))
      throw new BadRequestException("Validações de veículo não possuem conversa. Registre a decisão na análise.");
    const body = input.body.trim();
    if (!body) throw new BadRequestException("Escreva uma mensagem para enviar.");
    const fromCustomer = actor.role === UserRole.CUSTOMER;

    return this.prisma.$transaction(async (tx) => {
      const message = await tx.supportMessage.create({
        data: { ticketId: id, senderId: actor.userId, body },
        include: {
          sender: { select: { id: true, fullName: true, role: true } },
        },
      });
      await tx.supportTicket.update({
        where: { id },
        data: fromCustomer
          ? {
              status:
                ticket.status === SupportTicketStatus.RESOLVED ||
                ticket.status === SupportTicketStatus.CLOSED
                  ? SupportTicketStatus.OPEN
                  : ticket.status,
              resolution: null,
              resolvedAt: null,
            }
          : {
              status: SupportTicketStatus.IN_PROGRESS,
              assignedToId: ticket.assignedToId ?? actor.userId,
              resolvedAt: null,
            },
      });

      const recipients = fromCustomer
        ? await tx.user.findMany({
            where: {
              active: true,
              OR: [
                ...(ticket.assignedToId ? [{ id: ticket.assignedToId }] : []),
                ...(!ticket.assignedToId && ticket.dealershipId
                  ? [
                      {
                        dealershipId: ticket.dealershipId,
                        role: {
                          in: [
                            UserRole.DEALERSHIP_AGENT,
                            UserRole.DEALERSHIP_MANAGER,
                          ],
                        },
                      },
                    ]
                  : []),
                { role: UserRole.FORD_ADMIN },
              ],
            },
            select: { id: true },
          })
        : [{ id: ticket.requesterId }];
      const recipientIds = [...new Set(recipients.map(({ id: userId }) => userId))]
        .filter((userId) => userId !== actor.userId);
      if (recipientIds.length) {
        const staffLink = ticket.subject.startsWith(
          "Validação de veículo informado pelo cliente",
        )
          ? `/validacoes?ticket=${ticket.id}`
          : `/atendimentos?ticket=${ticket.id}`;
        await tx.notification.createMany({
          data: recipientIds.map((userId) => ({
            userId,
            type: "SYSTEM",
            title: fromCustomer
              ? "Nova mensagem de cliente"
              : "A equipe Ford respondeu",
            message: `${ticket.subject}: ${body.slice(0, 120)}`,
            link: fromCustomer ? staffLink : "/suporte",
          })),
        });
      }
      await tx.auditLog.create({
        data: {
          performedById: actor.userId,
          action: "SUPPORT_MESSAGE_SEND",
          entityType: "SupportMessage",
          entityId: message.id,
          metadata: { supportTicketId: id, senderRole: actor.role },
        },
      });
      return message;
    });
  }

  async update(
    id: string,
    input: UpdateSupportTicketDto,
    actor: AuthenticatedUser,
  ) {
    if (
      actor.role !== UserRole.FORD_ADMIN &&
      actor.role !== UserRole.DEALERSHIP_MANAGER
    )
      throw new ForbiddenException("Seu perfil não pode tratar chamados.");
    const ticket = await this.prisma.supportTicket.findFirst({
      where: { id, ...this.access(actor) },
    });
    if (!ticket) throw new NotFoundException("Chamado não encontrado.");
    if (
      input.status === SupportTicketStatus.RESOLVED &&
      !input.resolution?.trim()
    )
      throw new BadRequestException(
        "Informe a solução aplicada antes de resolver o chamado.",
      );
    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.supportTicket.update({
        where: { id },
        data: {
          status: input.status,
          resolution: input.resolution?.trim(),
          assignedToId: ticket.assignedToId ?? actor.userId,
          resolvedAt:
            input.status === SupportTicketStatus.RESOLVED ||
            input.status === SupportTicketStatus.CLOSED
              ? ticket.resolvedAt ?? new Date()
              : null,
        },
        include: {
          requester: { select: { id: true, fullName: true, email: true } },
          dealership: { select: { id: true, tradeName: true } },
          assignedTo: { select: { id: true, fullName: true } },
        },
      });
      await tx.notification.create({
        data: {
          userId: ticket.requesterId,
          type: "SYSTEM",
          title: "Chamado de suporte atualizado",
          message: `${ticket.subject}: ${input.status.replaceAll("_", " ")}`,
          link: "/suporte",
        },
      });
      await tx.auditLog.create({
        data: {
          performedById: actor.userId,
          action: "SUPPORT_TICKET_UPDATE",
          entityType: "SupportTicket",
          entityId: id,
          metadata: { from: ticket.status, to: input.status },
        },
      });
      return updated;
    });
  }

  async resolveVehicleValidation(
    id: string,
    input: ResolveVehicleValidationDto,
    actor: AuthenticatedUser,
  ) {
    if (
      actor.role !== UserRole.FORD_ADMIN &&
      actor.role !== UserRole.DEALERSHIP_MANAGER
    )
      throw new ForbiddenException("Seu perfil não pode validar veículos.");

    const ticket = await this.prisma.supportTicket.findFirst({
      where: { id, ...this.access(actor) },
      include: {
        requester: {
          select: {
            id: true,
            fullName: true,
            email: true,
            active: true,
            passwordSetupRequired: true,
          },
        },
        dealership: { select: { tradeName: true } },
      },
    });
    if (!ticket) throw new NotFoundException("Solicitação de validação não encontrada.");

    const vin = ticket.message.match(/(?:^|\n)VIN:\s*([A-HJ-NPR-Z0-9]{17})(?:\n|$)/)?.[1];
    if (!vin || !ticket.subject.startsWith("Validação de veículo informado pelo cliente"))
      throw new BadRequestException("Este chamado não corresponde a uma validação de veículo.");

    const requiresActivation =
      input.decision === "APPROVE" &&
      (!ticket.requester.active || ticket.requester.passwordSetupRequired);
    const activationToken = requiresActivation
      ? randomBytes(32).toString("hex")
      : null;
    const activationExpiresAt = activationToken
      ? new Date(Date.now() + 72 * 60 * 60 * 1000)
      : null;

    const result = await this.prisma.$transaction(async (tx) => {
      const vehicle = await tx.vehicle.findUnique({ where: { vin } });
      if (!vehicle) throw new NotFoundException("Veículo informado não encontrado.");
      if (
        actor.role !== UserRole.FORD_ADMIN &&
        ticket.dealershipId !== actor.dealershipId
      )
        throw new ForbiddenException("Solicitação fora da sua concessionária.");

      await tx.$queryRaw`SELECT id FROM Vehicle WHERE id = ${vehicle.id} FOR UPDATE`;
      const ownership = await tx.vehicleOwnership.findFirst({
        where: {
          vehicleId: vehicle.id,
          userId: ticket.requesterId,
          status: OwnershipStatus.PENDING_VERIFICATION,
        },
        orderBy: { createdAt: "desc" },
      });
      if (!ownership)
        throw new BadRequestException("Esta solicitação já foi tratada ou não possui vínculo pendente.");

      const approved = input.decision === "APPROVE";
      if (approved) {
        const activeOwner = await tx.vehicleOwnership.findFirst({
          where: { vehicleId: vehicle.id, status: OwnershipStatus.ACTIVE },
          select: { userId: true },
        });
        if (activeOwner && activeOwner.userId !== ticket.requesterId)
          throw new BadRequestException(
            "Não é possível aprovar: este VIN já possui outro proprietário ativo. Use a transferência de vínculo após conferir a documentação.",
          );
        await tx.vehicleOwnership.update({
          where: { id: ownership.id },
          data: { status: OwnershipStatus.ACTIVE, startedAt: new Date(), endedAt: null },
        });
        const declaredMileageText = ticket.message.match(/Quilometragem declarada:\s*([\d.]+)\s*km/i)?.[1];
        const declaredMileage = declaredMileageText
          ? Number(declaredMileageText.replace(/\D/g, ""))
          : null;
        const declaredColor = ticket.message.match(/Cor declarada:\s*([^\n]+)/i)?.[1]?.trim();
        await tx.vehicle.update({
          where: { id: vehicle.id },
          data: {
            currentMileage:
              declaredMileage !== null && Number.isFinite(declaredMileage)
                ? Math.max(vehicle.currentMileage, declaredMileage)
                : undefined,
            exteriorColor: declaredColor || undefined,
          },
        });
        await tx.loyaltyAccount.upsert({
          where: { userId: ticket.requesterId },
          update: {},
          create: { userId: ticket.requesterId },
        });
        if (activationToken && activationExpiresAt) {
          await tx.passwordResetToken.updateMany({
            where: { userId: ticket.requesterId, usedAt: null },
            data: { usedAt: new Date() },
          });
          await tx.passwordResetToken.create({
            data: {
              userId: ticket.requesterId,
              tokenHash: createHash("sha256")
                .update(activationToken)
                .digest("hex"),
              expiresAt: activationExpiresAt,
            },
          });
        }
      } else {
        await tx.vehicleOwnership.update({
          where: { id: ownership.id },
          data: { status: OwnershipStatus.ENDED, endedAt: new Date() },
        });
      }

      const resolution = input.resolution.trim();
      const updatedTicket = await tx.supportTicket.update({
        where: { id: ticket.id },
        data: {
          status: SupportTicketStatus.RESOLVED,
          resolution,
          validationDecision: approved ? "APPROVED" : "REJECTED",
          assignedToId: ticket.assignedToId ?? actor.userId,
          resolvedAt: new Date(),
        },
      });
      await tx.notification.create({
        data: {
          userId: ticket.requesterId,
          type: "SYSTEM",
          title: approved ? "Seu veículo foi validado" : "Atualização sobre a validação do veículo",
          message: approved
            ? `O vínculo do seu ${vehicle.model} foi validado. Ele já aparece na sua garagem do Ford App.`
            : `Não foi possível validar o vínculo do seu ${vehicle.model}. Confira a orientação da equipe e fale conosco se precisar.`,
          link: "/",
        },
      });
      await tx.auditLog.create({
        data: {
          performedById: actor.userId,
          action: approved ? "VEHICLE_OWNERSHIP_VALIDATED" : "VEHICLE_OWNERSHIP_REJECTED",
          entityType: "VehicleOwnership",
          entityId: ownership.id,
          metadata: { supportTicketId: ticket.id, vinSuffix: vin.slice(-6), requester: ticket.requester.fullName },
        },
      });
      const declaredColorForMessage = ticket.message.match(/Cor declarada:\s*([^\n]+)/i)?.[1]?.trim();
      return {
        updatedTicket,
        approved,
        vehicleLabel: `${vehicle.model} ${vehicle.modelYear}${declaredColorForMessage ? ` · ${declaredColorForMessage}` : ""} · VIN final ${vin.slice(-6)}`,
      };
    });
    const appUrl = (
      this.config.get<string>("APP_CUSTOMER_APP_URL") ??
      "http://localhost:8081"
    ).replace(/\/$/, "");
    if (!result.approved) {
      // A conta continua bloqueada, então o e-mail é o único canal que chega à pessoa.
      await this.messaging.enqueue(
        MessageChannel.EMAIL,
        "VEHICLE_REJECTED",
        ticket.requester.email,
        {
          fullName: ticket.requester.fullName,
          vehicleLabel: result.vehicleLabel,
          dealershipName: ticket.dealership?.tradeName ?? null,
          reason: input.resolution.trim(),
          appUrl,
        },
        { userId: ticket.requester.id },
      );
    } else {
      const delivery = await this.messaging.sendSensitive(
        MessageChannel.EMAIL,
        "VEHICLE_APPROVED",
        ticket.requester.email,
        {
          fullName: ticket.requester.fullName,
          vehicleLabel: result.vehicleLabel,
          dealershipName: ticket.dealership?.tradeName ?? null,
          appUrl,
          activationLink: activationToken
            ? `${appUrl}/?reset=${activationToken}`
            : null,
          activationExpiresAt: activationExpiresAt?.toISOString() ?? null,
        },
        { userId: ticket.requester.id },
      );
      if (activationToken && delivery.status !== MessageStatus.SENT) {
        await this.prisma.passwordResetToken.updateMany({
          where: {
            tokenHash: createHash("sha256").update(activationToken).digest("hex"),
            usedAt: null,
          },
          data: { usedAt: new Date() },
        });
      }
      return { ...result.updatedTicket, activationEmailSent: delivery.status === MessageStatus.SENT };
    }
    return result.updatedTicket;
  }
}
