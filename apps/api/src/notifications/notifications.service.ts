import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { Prisma, UserRole } from "@prisma/client";
import { AuthenticatedUser } from "../auth/auth.types";
import { PrismaService } from "../prisma/prisma.service";
import { CreateNotificationDto } from "./dto/create-notification.dto";

@Injectable()
export class NotificationsService {
  constructor(private readonly prisma: PrismaService) {}

  private access(actor: AuthenticatedUser): Prisma.NotificationWhereInput {
    if (actor.role === UserRole.CUSTOMER) return { userId: actor.userId };
    if (actor.role === UserRole.FORD_ADMIN)
      return {
        OR: [{ userId: actor.userId }, { userId: null, dealershipId: null }],
      };
    return {
      OR: [
        { userId: actor.userId },
        { userId: null, dealershipId: actor.dealershipId ?? "__none__" },
      ],
    };
  }

  async list(actor: AuthenticatedUser) {
    const items = await this.prisma.notification.findMany({
      where: this.access(actor),
      orderBy: { createdAt: "desc" },
      take: 50,
    });
    return { unread: items.filter((item) => !item.readAt).length, items };
  }

  async markRead(id: string, actor: AuthenticatedUser) {
    const notification = await this.prisma.notification.findFirst({
      where: { id, ...this.access(actor) },
    });
    if (!notification)
      throw new NotFoundException("Notificação não encontrada.");
    return this.prisma.notification.update({
      where: { id },
      data: { readAt: notification.readAt ?? new Date() },
    });
  }

  async create(input: CreateNotificationDto, actor: AuthenticatedUser) {
    const dealershipId =
      actor.role === UserRole.FORD_ADMIN
        ? input.dealershipId
        : actor.dealershipId;
    if (!input.userId && !dealershipId && actor.role !== UserRole.FORD_ADMIN)
      throw new BadRequestException("Defina o destinatário da notificação.");
    if (input.userId && actor.role !== UserRole.FORD_ADMIN) {
      const accessible = await this.prisma.user.count({
        where: {
          id: input.userId,
          ownerships: {
            some: {
              vehicle: {
                OR: [
                  { originDealershipId: actor.dealershipId ?? "__none__" },
                  {
                    serviceOrders: {
                      some: { dealershipId: actor.dealershipId ?? "__none__" },
                    },
                  },
                ],
              },
            },
          },
        },
      });
      if (!accessible)
        throw new ForbiddenException("Destinatário fora da sua operação.");
    }
    return this.prisma.$transaction(async (tx) => {
      const recipientIds = input.userId
        ? [input.userId]
        : dealershipId
          ? (
              await tx.user.findMany({
                where: { dealershipId, active: true },
                select: { id: true },
              })
            ).map((user) => user.id)
          : [actor.userId];
      if (!recipientIds.length)
        throw new BadRequestException("Nenhum destinatário ativo encontrado.");
      const result = await tx.notification.createMany({
        data: recipientIds.map((userId) => ({
          type: input.type,
          title: input.title,
          message: input.message,
          link: input.link,
          userId,
        })),
      });
      await tx.auditLog.create({
        data: {
          performedById: actor.userId,
          action: "NOTIFICATION_CREATE",
          entityType: "Notification",
          metadata: {
            type: input.type,
            userId: input.userId,
            dealershipId,
            recipients: result.count,
          },
        },
      });
      return { created: result.count };
    });
  }
}
