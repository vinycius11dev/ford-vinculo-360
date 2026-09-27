import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import { MessageChannel, MessageStatus, UserRole } from "@prisma/client";
import { compare, hash } from "bcryptjs";
import { createHash, randomBytes } from "node:crypto";
import { MessagingService } from "../messaging/messaging.service";
import { PrismaService } from "../prisma/prisma.service";
import { AuthenticatedUser } from "./auth.types";
import { AcceptInvitationDto } from "./dto/accept-invitation.dto";
import { ConfirmPasswordResetDto } from "./dto/confirm-password-reset.dto";
import { LoginDto } from "./dto/login.dto";
import { RegisterDto } from "./dto/register.dto";
import { RequestPasswordResetDto } from "./dto/request-password-reset.dto";

const RESET_MESSAGE =
  "Se o e-mail estiver cadastrado, as instruções de recuperação foram geradas.";
const REFRESH_TTL_MS = 30 * 24 * 60 * 60 * 1000;

export type SessionContext = {
  userAgent?: string;
  ipAddress?: string;
};

type TokenUser = {
  id: string;
  email: string;
  fullName: string;
  role: UserRole;
  dealershipId: string | null;
  sessionVersion: number;
  dealership: { tradeName: string } | null;
};

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly messaging: MessagingService,
  ) {}

  private webUrl() {
    return (
      this.config.get<string>("APP_WEB_URL") ?? "http://localhost:5173"
    );
  }

  private customerAppUrl() {
    return (
      this.config.get<string>("APP_CUSTOMER_APP_URL") ?? "http://localhost:8081"
    ).replace(/\/$/, "");
  }

  async login(
    input: LoginDto,
    context: SessionContext,
    allowedRoles?: UserRole[],
  ) {
    const user = await this.prisma.user.findUnique({
      where: { email: input.email.toLowerCase() },
      include: { dealership: true },
    });
    if (!user?.active)
      throw new UnauthorizedException("E-mail ou senha inválidos.");
    if (allowedRoles && !allowedRoles.includes(user.role))
      throw new UnauthorizedException("E-mail ou senha inválidos.");
    if (user.lockedUntil && user.lockedUntil > new Date())
      throw new UnauthorizedException(
        "Acesso temporariamente bloqueado. Aguarde 15 minutos ou recupere sua senha.",
      );
    if (!(await compare(input.password, user.passwordHash))) {
      const now = new Date();
      const lockUntil = new Date(now.getTime() + 15 * 60 * 1000);
      // A single row update serializes concurrent failures in MySQL. The fifth
      // failure starts the lock; later requests cannot clear/extend it.
      await this.prisma.$executeRaw`
        UPDATE \`User\`
        SET
          lockedUntil = IF(failedLoginAttempts + 1 >= 5, ${lockUntil}, lockedUntil),
          failedLoginAttempts = IF(failedLoginAttempts + 1 >= 5, 0, failedLoginAttempts + 1),
          updatedAt = ${now}
        WHERE id = ${user.id}
          AND active = 1
          AND (lockedUntil IS NULL OR lockedUntil <= ${now})
      `;
      throw new UnauthorizedException("E-mail ou senha inválidos.");
    }
    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: user.id },
        data: { failedLoginAttempts: 0, lockedUntil: null },
      }),
      this.prisma.auditLog.create({
        data: {
          performedById: user.id,
          action: "AUTH_LOGIN",
          entityType: "User",
          entityId: user.id,
          metadata: { device: this.deviceName(context.userAgent) },
          ipAddress: context.ipAddress,
        },
      }),
    ]);
    return this.startSession(user, context);
  }

  async register(input: RegisterDto, context: SessionContext) {
    const email = input.email.toLowerCase();
    if (await this.prisma.user.findUnique({ where: { email } }))
      throw new ConflictException("Já existe uma conta com este e-mail.");
    const user = await this.prisma.user.create({
      data: {
        email,
        fullName: input.fullName,
        phone: input.phone,
        passwordHash: await hash(input.password, 12),
        loyalty: { create: {} },
      },
      include: { dealership: true },
    });
    await this.prisma.auditLog.create({
      data: {
        performedById: user.id,
        action: "AUTH_REGISTER",
        entityType: "User",
        entityId: user.id,
        ipAddress: context.ipAddress,
      },
    });
    return this.startSession(user, context);
  }

  async refresh(refreshToken: string | undefined, context: SessionContext) {
    if (!refreshToken)
      throw new UnauthorizedException("Sessão de renovação ausente.");
    const current = await this.prisma.authSession.findUnique({
      where: { tokenHash: this.tokenHash(refreshToken) },
      include: { user: { include: { dealership: true } } },
    });
    if (
      !current ||
      current.revokedAt ||
      current.expiresAt <= new Date() ||
      !current.user.active
    )
      throw new UnauthorizedException("Sessão de renovação inválida ou expirada.");

    const nextToken = randomBytes(48).toString("hex");
    const nextSession = await this.prisma.$transaction(async (tx) => {
      const revoked = await tx.authSession.updateMany({
        where: { id: current.id, revokedAt: null },
        data: { revokedAt: new Date(), lastUsedAt: new Date() },
      });
      if (!revoked.count)
        throw new UnauthorizedException("Esta sessão já foi renovada.");
      return tx.authSession.create({
        data: {
          userId: current.userId,
          tokenHash: this.tokenHash(nextToken),
          deviceName: this.deviceName(context.userAgent ?? current.userAgent),
          userAgent: context.userAgent ?? current.userAgent,
          ipAddress: context.ipAddress ?? current.ipAddress,
          expiresAt: new Date(Date.now() + REFRESH_TTL_MS),
        },
      });
    });
    return this.issueSession(current.user, nextSession.id, nextToken);
  }

  async logout(refreshToken: string | undefined) {
    if (refreshToken)
      await this.prisma.authSession.updateMany({
        where: {
          tokenHash: this.tokenHash(refreshToken),
          revokedAt: null,
        },
        data: { revokedAt: new Date() },
      });
    return { message: "Sessão encerrada." };
  }

  async listSessions(actor: AuthenticatedUser) {
    const now = new Date();
    const sessions = await this.prisma.authSession.findMany({
      where: {
        userId: actor.userId,
        revokedAt: null,
        expiresAt: { gt: now },
      },
      select: {
        id: true,
        deviceName: true,
        ipAddress: true,
        lastUsedAt: true,
        expiresAt: true,
        createdAt: true,
      },
      orderBy: { lastUsedAt: "desc" },
    });
    return sessions.map((session) => ({
      ...session,
      isCurrent: session.id === actor.sessionId,
    }));
  }

  async revokeSession(id: string, actor: AuthenticatedUser) {
    const session = await this.prisma.authSession.findFirst({
      where: { id, userId: actor.userId, revokedAt: null },
    });
    if (!session) throw new NotFoundException("Sessão não encontrada.");
    await this.prisma.$transaction([
      this.prisma.authSession.update({
        where: { id },
        data: { revokedAt: new Date() },
      }),
      this.prisma.auditLog.create({
        data: {
          performedById: actor.userId,
          action: "AUTH_REVOKE_SESSION",
          entityType: "AuthSession",
          entityId: id,
          metadata: { device: session.deviceName },
        },
      }),
    ]);
    return { message: "Acesso do dispositivo encerrado." };
  }

  async requestPasswordReset(input: RequestPasswordResetDto) {
    const user = await this.prisma.user.findUnique({
      where: { email: input.email.toLowerCase() },
      select: { id: true, active: true, passwordSetupRequired: true, fullName: true, email: true, role: true },
    });
    if (!user || (!user.active && !user.passwordSetupRequired))
      return { message: RESET_MESSAGE };
    const token = randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000);
    await this.prisma.$transaction([
      this.prisma.passwordResetToken.updateMany({
        where: { userId: user.id, usedAt: null },
        data: { usedAt: new Date() },
      }),
      this.prisma.passwordResetToken.create({
        data: {
          userId: user.id,
          tokenHash: this.tokenHash(token),
          expiresAt,
        },
      }),
      this.prisma.auditLog.create({
        data: {
          action: "PASSWORD_RESET_REQUEST",
          entityType: "User",
          entityId: user.id,
        },
      }),
    ]);
    const delivery = await this.messaging.sendSensitive(
      MessageChannel.EMAIL,
      "PASSWORD_RESET",
      user.email,
      {
        fullName: user.fullName,
        link: `${user.role === UserRole.CUSTOMER ? this.customerAppUrl() : this.webUrl()}/?reset=${token}`,
        expiresAt: expiresAt.toISOString(),
      },
      { userId: user.id },
    );
    if (delivery.status !== MessageStatus.SENT) {
      await this.prisma.passwordResetToken.updateMany({
        where: { tokenHash: this.tokenHash(token), usedAt: null },
        data: { usedAt: new Date() },
      });
    }
    return {
      message: RESET_MESSAGE,
      ...(delivery.status === MessageStatus.SENT &&
      this.config.get("NODE_ENV") === "development" &&
      this.config.get("EXPOSE_DEVELOPMENT_TOKENS") === "true" &&
      !this.config.get("SMTP_HOST")
        ? { developmentToken: token }
        : {}),
    };
  }

  async confirmPasswordReset(input: ConfirmPasswordResetDto) {
    const reset = await this.prisma.passwordResetToken.findFirst({
      where: {
        tokenHash: this.tokenHash(input.token),
        usedAt: null,
        expiresAt: { gt: new Date() },
      },
    });
    if (!reset)
      throw new BadRequestException("Código de recuperação inválido ou expirado.");
    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: reset.userId },
        data: {
          passwordHash: await hash(input.password, 12),
          passwordChangedAt: new Date(),
          active: true,
          passwordSetupRequired: false,
          failedLoginAttempts: 0,
          lockedUntil: null,
          sessionVersion: { increment: 1 },
        },
      }),
      this.prisma.authSession.updateMany({
        where: { userId: reset.userId, revokedAt: null },
        data: { revokedAt: new Date() },
      }),
      this.prisma.passwordResetToken.update({
        where: { id: reset.id },
        data: { usedAt: new Date() },
      }),
      this.prisma.auditLog.create({
        data: {
          performedById: reset.userId,
          action: "PASSWORD_RESET_CONFIRM",
          entityType: "User",
          entityId: reset.userId,
        },
      }),
    ]);
    return { message: "Senha atualizada. Entre novamente com a nova senha." };
  }

  async acceptInvitation(input: AcceptInvitationDto, context: SessionContext) {
    const invitation = await this.prisma.userInvitation.findFirst({
      where: {
        tokenHash: this.tokenHash(input.token),
        acceptedAt: null,
        cancelledAt: null,
        expiresAt: { gt: new Date() },
      },
    });
    if (!invitation)
      throw new BadRequestException("Convite inválido, cancelado ou expirado.");
    if (await this.prisma.user.count({ where: { email: invitation.email } }))
      throw new ConflictException("Já existe uma conta com este e-mail.");
    const user = await this.prisma.$transaction(async (tx) => {
      const created = await tx.user.create({
        data: {
          email: invitation.email,
          fullName: invitation.fullName,
          phone: invitation.phone,
          role: invitation.role,
          dealershipId:
            invitation.role === UserRole.FORD_ADMIN
              ? null
              : invitation.dealershipId,
          passwordHash: await hash(input.password, 12),
        },
        include: { dealership: true },
      });
      await tx.userInvitation.update({
        where: { id: invitation.id },
        data: { acceptedAt: new Date() },
      });
      await tx.auditLog.create({
        data: {
          performedById: created.id,
          action: "TEAM_INVITATION_ACCEPT",
          entityType: "UserInvitation",
          entityId: invitation.id,
          metadata: { role: invitation.role },
          ipAddress: context.ipAddress,
        },
      });
      return created;
    });
    return this.startSession(user, context);
  }

  async logoutAll(actor: AuthenticatedUser) {
    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: actor.userId },
        data: { sessionVersion: { increment: 1 } },
      }),
      this.prisma.authSession.updateMany({
        where: { userId: actor.userId, revokedAt: null },
        data: { revokedAt: new Date() },
      }),
      this.prisma.auditLog.create({
        data: {
          performedById: actor.userId,
          action: "AUTH_REVOKE_SESSIONS",
          entityType: "User",
          entityId: actor.userId,
        },
      }),
    ]);
    return { message: "Todas as sessões foram encerradas." };
  }

  async me(userId: string) {
    return this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        fullName: true,
        phone: true,
        role: true,
        dealershipId: true,
        passwordChangedAt: true,
        dealership: {
          select: { id: true, tradeName: true, city: true, state: true },
        },
        loyalty: { select: { balance: true } },
      },
    });
  }

  private async startSession(user: TokenUser, context: SessionContext) {
    const refreshToken = randomBytes(48).toString("hex");
    const session = await this.prisma.authSession.create({
      data: {
        userId: user.id,
        tokenHash: this.tokenHash(refreshToken),
        deviceName: this.deviceName(context.userAgent),
        userAgent: context.userAgent,
        ipAddress: context.ipAddress,
        expiresAt: new Date(Date.now() + REFRESH_TTL_MS),
      },
    });
    return this.issueSession(user, session.id, refreshToken);
  }

  private issueSession(
    user: TokenUser,
    sessionId: string,
    refreshToken: string,
  ) {
    const accessToken = this.jwt.sign({
      sub: user.id,
      email: user.email,
      role: user.role,
      dealershipId: user.dealershipId,
      sessionVersion: user.sessionVersion,
      sessionId,
    });
    return {
      accessToken,
      refreshToken,
      expiresIn: 900,
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        role: user.role,
        dealershipId: user.dealershipId,
        dealershipName: user.dealership?.tradeName ?? null,
      },
    };
  }

  private tokenHash(token: string) {
    return createHash("sha256").update(token).digest("hex");
  }

  private deviceName(userAgent?: string | null) {
    if (!userAgent) return "Dispositivo não identificado";
    const browser = /Edg\//.test(userAgent)
      ? "Microsoft Edge"
      : /Firefox\//.test(userAgent)
        ? "Firefox"
        : /Chrome\//.test(userAgent)
          ? "Google Chrome"
          : /Safari\//.test(userAgent)
            ? "Safari"
            : "Navegador";
    const platform = /Windows/.test(userAgent)
      ? "Windows"
      : /Android/.test(userAgent)
        ? "Android"
        : /iPhone|iPad/.test(userAgent)
          ? "iOS"
          : /Mac OS/.test(userAgent)
            ? "macOS"
            : /Linux/.test(userAgent)
              ? "Linux"
              : "Outro sistema";
    return `${browser} · ${platform}`;
  }
}
