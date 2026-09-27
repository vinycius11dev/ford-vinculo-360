import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Body, Controller, Get, Patch, Post, UseGuards } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { IsEmail, IsInt, Max, Min } from 'class-validator';
import { MessageChannel, MessageTemplateKey, UserRole } from '@prisma/client';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { CurrentUser } from '../auth/current-user.decorator';
import { AuthenticatedUser } from '../auth/auth.types';
import { PrismaService } from '../prisma/prisma.service';
import { MessagingService } from '../messaging/messaging.service';

export class UpdateProgramDto {
  @IsInt() @Min(0) @Max(100000) minimumPoints!: number;
  @IsInt() @Min(1) @Max(100000) mileagePerPoint!: number;
}

export class TestEmailDto {
  @IsEmail()
  recipient!: string;
}

@ApiTags('settings')
@Controller('settings')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
export class SettingsController {
  constructor(private readonly prisma: PrismaService, private readonly config: ConfigService, private readonly messaging: MessagingService) {}

  @Get('program')
  async program() {
    return await this.prisma.programSettings.findUnique({ where: { id: 'default' } }) ?? { id: 'default', minimumPoints: 100, mileagePerPoint: 100 };
  }

  @Patch('program')
  @Roles(UserRole.FORD_ADMIN)
  updateProgram(@Body() input: UpdateProgramDto, @CurrentUser() actor: AuthenticatedUser) {
    return this.prisma.$transaction(async (tx) => {
      const result = await tx.programSettings.upsert({ where: { id: 'default' }, create: { id: 'default', ...input }, update: input });
      await tx.auditLog.create({ data: { performedById: actor.userId, action: 'PROGRAM_SETTINGS_UPDATE', entityType: 'ProgramSettings', entityId: 'default', metadata: { minimumPoints: input.minimumPoints, mileagePerPoint: input.mileagePerPoint } } });
      return result;
    });
  }

  @Get('integrations')
  @Roles(UserRole.FORD_ADMIN, UserRole.DEALERSHIP_MANAGER)
  async integrations() {
    let database = false;
    let prediction = false;
    try { await this.prisma.$queryRaw`SELECT 1`; database = true; } catch { /* Expose status only. */ }
    try { prediction = (await fetch(`${this.config.get('ML_SERVICE_URL', 'http://127.0.0.1:8000')}/health`, { signal: AbortSignal.timeout(2000) })).ok; } catch { /* Local prediction fallback remains available. */ }
    return { database, prediction, email: this.config.get('SMTP_HOST') ? 'smtp' : 'simulation', sms: 'simulation', push: 'simulation', dms: 'not_configured', crm: 'not_configured', checkedAt: new Date().toISOString() };
  }

  @Post('email/test')
  @Roles(UserRole.FORD_ADMIN, UserRole.DEALERSHIP_MANAGER)
  async testEmail(@Body() input: TestEmailDto, @CurrentUser() actor: AuthenticatedUser) {
    if (!this.config.get('SMTP_HOST')) {
      return { status: 'simulation', message: 'SMTP não configurado. Configure as variáveis SMTP antes de enviar um teste.' };
    }
    const profile = await this.prisma.user.findUnique({ where: { id: actor.userId }, select: { fullName: true } });
    const message = await this.messaging.enqueue(
      MessageChannel.EMAIL,
      MessageTemplateKey.EMAIL_TEST,
      input.recipient.trim(),
      {
        fullName: profile?.fullName ?? 'Equipe Ford',
        appUrl: this.config.get('APP_WEB_URL', 'http://localhost:5173'),
        sentAt: new Date().toISOString(),
      },
      { userId: actor.userId, maxAttempts: 1, defer: true },
    );
    await this.messaging.deliverNow(message.id);
    const result = await this.messaging.findOne(message.id, actor);
    return { status: result.status === 'SENT' ? 'sent' : 'failed', messageId: result.id, providerRef: result.providerRef, error: result.lastError };
  }
}
