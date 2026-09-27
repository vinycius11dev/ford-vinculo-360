import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleDestroy,
  OnModuleInit,
  ServiceUnavailableException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import {
  MessageChannel,
  MessageStatus,
  MessageTemplateKey,
  Prisma,
  UserRole,
} from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { AuthenticatedUser } from "../auth/auth.types";
import { ConsoleProvider } from "./providers/console.provider";
import { SmtpEmailProvider } from "./providers/smtp-email.provider";
import { MessageDeliveryResult, MessageProvider } from "./providers/message-provider.interface";
import { renderTemplate, TemplatePayloads } from "./templates";

const POLL_INTERVAL_MS = 15_000;
const BATCH_SIZE = 20;
const RETRY_BACKOFF_MINUTES = [1, 5, 15, 60, 240];
const SENSITIVE_TEMPLATES = new Set<MessageTemplateKey>([
  MessageTemplateKey.TEAM_INVITATION,
  MessageTemplateKey.CUSTOMER_ACTIVATION,
  MessageTemplateKey.PASSWORD_RESET,
  MessageTemplateKey.VEHICLE_APPROVED,
]);

@Injectable()
export class MessagingService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger("MessagingService");
  private timer: ReturnType<typeof setInterval> | null = null;
  private polling = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly consoleProvider: ConsoleProvider,
    private readonly smtpEmailProvider: SmtpEmailProvider,
  ) {}

  onModuleInit() {
    this.timer = setInterval(() => {
      this.pollDue().catch((error) =>
        this.logger.error(JSON.stringify({
          event: "message.queue_processing_failed",
          errorType: error instanceof Error ? error.name : "UnknownError",
        })),
      );
    }, POLL_INTERVAL_MS);
    this.timer.unref?.();
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  async enqueue<K extends MessageTemplateKey>(
    channel: MessageChannel,
    templateKey: K,
    recipient: string,
    payload: TemplatePayloads[K],
    options?: { userId?: string; campaignTargetId?: string; maxAttempts?: number; defer?: boolean },
  ) {
    if (SENSITIVE_TEMPLATES.has(templateKey)) {
      throw new Error("Credential-bearing templates must use sendSensitive().");
    }
    const message = await this.prisma.outboundMessage.create({
      data: {
        channel,
        templateKey,
        recipient,
        payload: payload as Prisma.InputJsonValue,
        userId: options?.userId,
        campaignTargetId: options?.campaignTargetId,
        maxAttempts: options?.maxAttempts ?? 5,
      },
    });
    if (!options?.defer) {
      this.deliver(message.id).catch((error) =>
        this.logger.error(JSON.stringify({
          event: "message.delivery_processing_failed",
          messageId: message.id,
          errorType: error instanceof Error ? error.name : "UnknownError",
        })),
      );
    }
    return message;
  }

  /**
   * Sends a one-time credential without putting its token, link, or rendered
   * content in the durable outbox. Failed credentials must be regenerated.
   */
  async sendSensitive<K extends MessageTemplateKey>(
    channel: MessageChannel,
    templateKey: K,
    recipient: string,
    payload: TemplatePayloads[K],
    options?: { userId?: string },
  ): Promise<{ id: string; status: MessageStatus }> {
    if (!SENSITIVE_TEMPLATES.has(templateKey) || channel !== MessageChannel.EMAIL) {
      throw new Error("sendSensitive() only accepts credential-bearing email templates.");
    }

    const message = await this.prisma.outboundMessage.create({
      data: {
        channel,
        templateKey,
        recipient,
        payload: { redacted: true } as Prisma.InputJsonValue,
        userId: options?.userId,
        maxAttempts: 1,
        attempts: 1,
        status: MessageStatus.SENDING,
      },
      select: { id: true },
    });

    let result: MessageDeliveryResult | null = null;
    let failureType: string | null = null;
    try {
      if (
        this.config.get("NODE_ENV") === "production" &&
        !this.config.get("SMTP_HOST")
      ) {
        throw new ServiceUnavailableException("Email provider is not configured.");
      }
      const content = renderTemplate(
        templateKey,
        payload as TemplatePayloads[typeof templateKey],
      );
      result = await this.providerFor(channel).send({ channel, recipient, content });
    } catch (error) {
      failureType = error instanceof Error ? error.name : "UnknownError";
    }

    const sent = result !== null;
    const safeDetail = sent
      ? "Entrega concluída; conteúdo sensível omitido."
      : "Falha na entrega; solicite uma nova credencial.";
    await this.prisma.$transaction([
      this.prisma.outboundMessage.update({
        where: { id: message.id },
        data: sent
          ? {
              status: MessageStatus.SENT,
              sentAt: new Date(),
              providerRef: result?.providerRef ?? null,
            }
          : {
              status: MessageStatus.FAILED,
              failedAt: new Date(),
              lastError: safeDetail,
            },
      }),
      this.prisma.messageEvent.create({
        data: {
          messageId: message.id,
          status: sent ? MessageStatus.SENT : MessageStatus.FAILED,
          detail: safeDetail,
        },
      }),
    ]);
    if (failureType) {
      this.logger.warn(JSON.stringify({
        event: "message.sensitive_delivery_failed",
        messageId: message.id,
        errorType: failureType,
      }));
    }
    return { id: message.id, status: sent ? MessageStatus.SENT : MessageStatus.FAILED };
  }

  deliverNow(id: string) {
    return this.deliver(id);
  }

  private providerFor(channel: MessageChannel): MessageProvider {
    if (channel === MessageChannel.EMAIL && this.config.get("SMTP_HOST"))
      return this.smtpEmailProvider;
    if (this.config.get("NODE_ENV") === "production") {
      throw new ServiceUnavailableException(
        "A transportadora de mensagens não está configurada.",
      );
    }
    return this.consoleProvider;
  }

  private async deliver(id: string) {
    const message = await this.prisma.outboundMessage.findUnique({
      where: { id },
    });
    if (!message || message.status === MessageStatus.SENT) return;
    if (message.status === MessageStatus.CANCELLED) return;

    // Old rows may still hold a live bearer link. Never deliver or retry them.
    if (SENSITIVE_TEMPLATES.has(message.templateKey)) {
      await this.prisma.$transaction([
        this.prisma.outboundMessage.update({
          where: { id },
          data: {
            status: MessageStatus.CANCELLED,
            cancelledAt: new Date(),
            payload: { redacted: true },
            lastError: "Mensagem cancelada por conter credencial sensível.",
          },
        }),
        this.prisma.messageEvent.create({
          data: {
            messageId: id,
            status: MessageStatus.CANCELLED,
            detail: "Mensagem antiga cancelada e conteúdo omitido por segurança.",
          },
        }),
      ]);
      this.logger.warn(JSON.stringify({
        event: "message.legacy_sensitive_cancelled",
        messageId: id,
      }));
      return;
    }
    if (message.attempts >= message.maxAttempts) return;

    await this.prisma.outboundMessage.update({
      where: { id },
      data: { status: MessageStatus.SENDING, attempts: { increment: 1 } },
    });

    try {
      const content = renderTemplate(
        message.templateKey,
        message.payload as TemplatePayloads[typeof message.templateKey],
      );
      const result = await this.providerFor(message.channel).send({
        channel: message.channel,
        recipient: message.recipient,
        content,
      });
      await this.prisma.$transaction([
        this.prisma.outboundMessage.update({
          where: { id },
          data: {
            status: MessageStatus.SENT,
            sentAt: new Date(),
            providerRef: result.providerRef,
            lastError: null,
          },
        }),
        this.prisma.messageEvent.create({
          data: {
            messageId: id,
            status: MessageStatus.SENT,
            detail: "Entrega concluída; conteúdo omitido.",
          },
        }),
      ]);
    } catch (error) {
      const attempts = message.attempts + 1;
      const errorType = error instanceof Error ? error.name : "UnknownError";
      const safeError = "Falha na entrega; verifique a configuração do provedor.";
      const exhausted = attempts >= message.maxAttempts;
      await this.prisma.$transaction([
        this.prisma.outboundMessage.update({
          where: { id },
          data: exhausted
            ? {
                status: MessageStatus.FAILED,
                failedAt: new Date(),
                lastError: safeError,
              }
            : {
                status: MessageStatus.PENDING,
                lastError: safeError,
                nextAttemptAt: this.nextAttemptAt(attempts),
              },
        }),
        this.prisma.messageEvent.create({
          data: {
            messageId: id,
            status: exhausted ? MessageStatus.FAILED : MessageStatus.PENDING,
            detail: safeError,
          },
        }),
      ]);
      this.logger.warn(JSON.stringify({
        event: "message.delivery_failed",
        messageId: id,
        attempt: attempts,
        errorType,
      }));
    }
  }

  private nextAttemptAt(attempts: number) {
    const minutes =
      RETRY_BACKOFF_MINUTES[
        Math.min(attempts - 1, RETRY_BACKOFF_MINUTES.length - 1)
      ];
    return new Date(Date.now() + minutes * 60 * 1000);
  }

  private async pollDue() {
    if (this.polling) return;
    this.polling = true;
    try {
      const due = await this.prisma.outboundMessage.findMany({
        where: {
          status: MessageStatus.PENDING,
          nextAttemptAt: { lte: new Date() },
        },
        take: BATCH_SIZE,
        orderBy: { nextAttemptAt: "asc" },
      });
      for (const message of due) await this.deliver(message.id);
    } finally {
      this.polling = false;
    }
  }

  private access(actor: AuthenticatedUser): Prisma.OutboundMessageWhereInput {
    return actor.role === UserRole.FORD_ADMIN ? {} : { userId: actor.userId };
  }

  private safeMessage<T extends {
    payload: unknown;
    lastError: string | null;
    events?: Array<{ detail: string | null }>;
  }>(message: T) {
    const { payload: _payload, lastError, events, ...safe } = message;
    return {
      ...safe,
      lastError: lastError
        ? "Falha na entrega; verifique a configuração do provedor."
        : null,
      ...(events
        ? {
            events: events.map(({ detail, ...event }) => ({
              ...event,
              detail: detail ? "Detalhe omitido por segurança." : null,
            })),
          }
        : {}),
    };
  }

  async list(
    actor: AuthenticatedUser,
    filters: { status?: MessageStatus; channel?: MessageChannel },
  ) {
    const messages = await this.prisma.outboundMessage.findMany({
      where: {
        ...this.access(actor),
        status: filters.status,
        channel: filters.channel,
      },
      orderBy: { createdAt: "desc" },
      take: 100,
    });
    return messages.map((message) => this.safeMessage(message));
  }

  async findOne(id: string, actor: AuthenticatedUser) {
    const message = await this.prisma.outboundMessage.findFirst({
      where: { id, ...this.access(actor) },
      include: { events: { orderBy: { createdAt: "desc" } } },
    });
    if (!message) throw new NotFoundException("Mensagem não encontrada.");
    return this.safeMessage(message);
  }

  async retry(id: string, actor: AuthenticatedUser) {
    const message = await this.findOne(id, actor);
    if (SENSITIVE_TEMPLATES.has(message.templateKey as MessageTemplateKey))
      throw new BadRequestException(
        "Mensagens com links de acesso não podem ser reenviadas; gere uma nova credencial.",
      );
    if (message.status !== MessageStatus.FAILED)
      throw new BadRequestException(
        "Somente mensagens com falha podem ser reenviadas.",
      );
    await this.prisma.$transaction([
      this.prisma.outboundMessage.update({
        where: { id },
        data: {
          status: MessageStatus.PENDING,
          attempts: 0,
          nextAttemptAt: new Date(),
          lastError: null,
          failedAt: null,
        },
      }),
      this.prisma.auditLog.create({
        data: {
          performedById: actor.userId,
          action: "MESSAGE_RETRY",
          entityType: "OutboundMessage",
          entityId: id,
        },
      }),
    ]);
    this.deliver(id).catch((error) =>
      this.logger.error(JSON.stringify({
        event: "message.retry_processing_failed",
        messageId: id,
        errorType: error instanceof Error ? error.name : "UnknownError",
      })),
    );
    return this.findOne(id, actor);
  }

  async cancel(id: string, actor: AuthenticatedUser) {
    const message = await this.findOne(id, actor);
    if (message.status === MessageStatus.SENT)
      throw new BadRequestException(
        "Esta mensagem já foi entregue e não pode ser cancelada.",
      );
    await this.prisma.$transaction([
      this.prisma.outboundMessage.update({
        where: { id },
        data: { status: MessageStatus.CANCELLED, cancelledAt: new Date() },
      }),
      this.prisma.auditLog.create({
        data: {
          performedById: actor.userId,
          action: "MESSAGE_CANCEL",
          entityType: "OutboundMessage",
          entityId: id,
        },
      }),
    ]);
    return this.findOne(id, actor);
  }
}
