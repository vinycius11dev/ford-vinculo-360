import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MessageChannel, Prisma, UserRole } from '@prisma/client';
import { AuthenticatedUser } from '../auth/auth.types';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCampaignDto } from './dto/create-campaign.dto';
import { MessagingService } from '../messaging/messaging.service';

@Injectable()
export class CampaignsService {
  constructor(private readonly prisma: PrismaService, private readonly messaging: MessagingService, private readonly config: ConfigService) {}

  private vehicleAccess(actor: AuthenticatedUser): Prisma.VehicleWhereInput {
    if (actor.role === UserRole.FORD_ADMIN) return {};
    return {
      OR: [
        { originDealershipId: actor.dealershipId ?? '__none__' },
        {
          serviceOrders: {
            some: { dealershipId: actor.dealershipId ?? '__none__' },
          },
        },
      ],
    };
  }

  async offers(actor: AuthenticatedUser) {
    if (actor.role !== UserRole.CUSTOMER) return { marketingConsent: false, items: [] };

    const consent = await this.prisma.userConsent.findUnique({
      where: {
        userId_purpose: { userId: actor.userId, purpose: 'MARKETING' },
      },
      select: { granted: true },
    });
    if (!consent?.granted)
      return { marketingConsent: false, items: [] };

    const now = new Date();
    const targets = await this.prisma.campaignTarget.findMany({
      where: {
        sentAt: { not: null },
        campaign: {
          active: true,
          startsAt: { lte: now },
          endsAt: { gte: now },
          publicTitle: { not: null },
          publicDescription: { not: null },
        },
        vehicle: {
          ownerships: {
            some: {
              userId: actor.userId,
              status: 'ACTIVE',
            },
          },
        },
      },
      select: {
        id: true,
        campaign: {
          select: {
            id: true,
            publicTitle: true,
            publicDescription: true,
            publicCtaLabel: true,
            publicCtaLink: true,
            startsAt: true,
            endsAt: true,
          },
        },
        vehicle: {
          select: { vin: true, model: true, modelYear: true },
        },
      },
      orderBy: { campaign: { endsAt: 'asc' } },
      take: 30,
    });

    if (targets.length) {
      await this.prisma.campaignTarget.updateMany({
        where: { id: { in: targets.map((target) => target.id) }, viewedAt: null },
        data: { viewedAt: new Date() },
      });
    }

    return {
      marketingConsent: true,
      items: targets.map(({ campaign, vehicle }) => ({
        id: campaign.id,
        title: campaign.publicTitle!,
        description: campaign.publicDescription!,
        startsAt: campaign.startsAt,
        endsAt: campaign.endsAt,
        cta: {
          label: campaign.publicCtaLabel ?? 'Saiba mais',
          link: campaign.publicCtaLink ?? '/agendamentos',
        },
        vehicle,
      })),
    };
  }

  async getSmartSegments(actor: AuthenticatedUser) {
    const vehicleWhere = this.vehicleAccess(actor);
    const vehicles = await this.prisma.vehicle.findMany({
      where: {
        ...vehicleWhere,
        ownerships: { some: { status: 'ACTIVE' } },
      },
      select: {
        id: true,
        vin: true,
        model: true,
        manufactureYear: true,
        serviceOrders: {
          where: { status: 'COMPLETED' },
          orderBy: { completedAt: 'desc' },
          take: 1,
          select: { completedAt: true },
        },
        ownerships: {
          where: { status: 'ACTIVE' },
          take: 1,
          select: { startedAt: true },
        },
      },
    });

    const now = Date.now();
    const dayMs = 86_400_000;

    const churnRiskVins: string[] = [];
    const serviceDueVins: string[] = [];
    const byModel: Record<string, string[]> = {};

    for (const v of vehicles) {
      const lastService = v.serviceOrders[0]?.completedAt;
      const startedAt = v.ownerships[0]?.startedAt;
      const refDate = lastService ?? startedAt;
      const daysSince = refDate ? Math.floor((now - refDate.getTime()) / dayMs) : 0;

      if (daysSince >= 240) churnRiskVins.push(v.vin);
      if (daysSince >= 330) serviceDueVins.push(v.vin);

      if (!byModel[v.model]) byModel[v.model] = [];
      byModel[v.model].push(v.vin);
    }

    const segments = [
      {
        id: 'churn-risk',
        title: 'Risco de Churn (IA)',
        badge: 'Recomendação Preditiva',
        description: 'Veículos com mais de 8 meses sem serviço na concessionária',
        count: churnRiskVins.length,
        vins: churnRiskVins,
        suggestedTone: 'OFERTA',
      },
      {
        id: 'service-due',
        title: 'Revisão Anual Vencida',
        badge: 'Urgência Preventiva',
        description: 'Veículos com mais de 11 meses da última revisão periódica',
        count: serviceDueVins.length,
        vins: serviceDueVins,
        suggestedTone: 'FAMILIA',
      },
      ...Object.entries(byModel).map(([model, vins]) => ({
        id: `model-${model.toLowerCase().replace(/\\s+/g, '-')}`,
        title: `Proprietários de ${model}`,
        badge: `${vins.length} veículo(s)`,
        description: `Todos os clientes com ${model} ativo na carteira da sua unidade`,
        count: vins.length,
        vins,
        suggestedTone: model.toLowerCase().includes('ranger')
          ? 'TRABALHO'
          : model.toLowerCase().includes('mustang') || model.toLowerCase().includes('150')
            ? 'PREMIUM'
            : 'FAMILIA',
      })),
    ];

    return segments;
  }

  list(actor: AuthenticatedUser) {
    const vehicle = this.vehicleAccess(actor);
    const where: Prisma.CampaignWhereInput =
      actor.role === UserRole.FORD_ADMIN
        ? {}
        : { targets: { some: { vehicle } } };
    return this.prisma.campaign.findMany({
      where,
      include: {
        _count: { select: { targets: { where: { vehicle } } } },
        targets: {
          where: { vehicle },
          select: {
            id: true,
            sentAt: true,
            viewedAt: true,
            convertedAt: true,
            vehicle: {
              select: {
                id: true,
                vin: true,
                model: true,
                plate: true,
                modelYear: true,
              },
            },
          },
        },
      },
      orderBy: { startsAt: 'desc' },
      take: 100,
    });
  }
  async create(input: CreateCampaignDto, actor: AuthenticatedUser) {
    const startsAt = new Date(input.startsAt); const endsAt = new Date(input.endsAt);
    if (endsAt <= startsAt) throw new BadRequestException('A data final deve ser posterior à inicial.');
    const hasAnyPublicContent = Boolean(
      input.publicTitle ||
        input.publicDescription ||
        input.publicCtaLabel ||
        input.publicCtaLink,
    );
    if (hasAnyPublicContent && (!input.publicTitle || !input.publicDescription))
      throw new BadRequestException(
        'Título e descrição públicos são obrigatórios para publicar a oferta no aplicativo.',
      );
    const vins = [...new Set((input.vehicleVins ?? []).map(v => v.toUpperCase()))];
    const vehicles = vins.length ? await this.prisma.vehicle.findMany({ where: { vin: { in: vins }, ...this.vehicleAccess(actor) }, select: { id: true, vin: true } }) : [];
    if (vins.length && vehicles.length !== vins.length) throw new NotFoundException('Um ou mais veículos não foram encontrados ou estão fora do seu acesso.');
    const recommendationVins = [...new Set((input.recommendationVins ?? []).map((vin) => vin.toUpperCase()))];
    if (recommendationVins.some((vin) => !vins.includes(vin))) {
      throw new BadRequestException('Todo VIN de recomendação precisa estar incluído no público da campanha.');
    }
    if (recommendationVins.length) {
      if (!input.recommendationModelVersion) {
        throw new BadRequestException('A versão do modelo é obrigatória para uma campanha originada por recomendação.');
      }
      const recommendationVehicleIds = vehicles
        .filter((vehicle) => recommendationVins.includes(vehicle.vin))
        .map((vehicle) => vehicle.id);
      const reviews = await this.prisma.aiRecommendationReview.findMany({
        where: {
          vehicleId: { in: recommendationVehicleIds },
          modelVersion: input.recommendationModelVersion,
        },
        select: { vehicleId: true, decision: true },
      });
      const pending = recommendationVehicleIds.filter(
        (vehicleId) => reviews.find((review) => review.vehicleId === vehicleId)?.decision !== 'APPROVED',
      );
      if (pending.length) {
        throw new BadRequestException('A recomendação da IA precisa ser aprovada por uma pessoa antes de criar a campanha.');
      }
    }
    return this.prisma.$transaction(async tx => {
      const campaign = await tx.campaign.create({ data: { name: input.name, description: input.description, publicTitle: input.publicTitle, publicDescription: input.publicDescription, publicCtaLabel: input.publicCtaLabel, publicCtaLink: input.publicCtaLink, startsAt, endsAt, targets: { create: vehicles.map(vehicle => ({ vehicleId: vehicle.id })) } }, include: { _count: { select: { targets: true } } } });
      await tx.auditLog.create({ data: { performedById: actor.userId, action: 'CAMPAIGN_CREATE', entityType: 'Campaign', entityId: campaign.id, metadata: { targetCount: vehicles.length, approvedRecommendationVins: recommendationVins, recommendationModelVersion: input.recommendationModelVersion ?? null } } });
      return campaign;
    });
  }
  async dispatch(id: string, actor: AuthenticatedUser) {
    const vehicle = this.vehicleAccess(actor);
    const campaign = await this.prisma.campaign.findFirst({ where: { id, ...(actor.role === UserRole.FORD_ADMIN ? {} : { targets: { some: { vehicle } } }) } });
    if (!campaign) throw new NotFoundException('Campanha não encontrada.');
    if (!campaign.publicTitle || !campaign.publicDescription) {
      throw new BadRequestException('A campanha precisa de título e descrição públicos antes do disparo.');
    }
    const pendingTargets = await this.prisma.campaignTarget.findMany({
      where: { campaignId: id, sentAt: null, vehicle },
      select: {
        id: true,
        vehicle: {
          select: {
            model: true,
            ownerships: {
              where: { status: 'ACTIVE' },
              take: 1,
              select: {
                user: {
                  select: {
                    id: true,
                    fullName: true,
                    email: true,
                    phone: true,
                    consents: { where: { purpose: 'MARKETING', granted: true }, select: { id: true }, take: 1 },
                  },
                },
              },
            },
          },
        },
      },
    });
    const dispatchable = pendingTargets.filter((target) => {
      const owner = target.vehicle.ownerships[0]?.user;
      return Boolean(owner?.consents.length && (owner.email || owner.phone));
    });
    const sentAt = new Date();
    // A ação recebida por e-mail pertence ao Ford App do cliente, nunca ao
    // painel administrativo da concessionária.
    const appUrl = this.config.get('APP_CUSTOMER_APP_URL', 'http://localhost:8081').replace(/\/$/, '');
    const configuredLink = campaign.publicCtaLink ?? '/agendamentos';
    const ctaLink = /^https?:\/\//i.test(configuredLink) ? configuredLink : `${appUrl}${configuredLink.startsWith('/') ? '' : '/'}${configuredLink}`;
    const messageIds: string[] = [];
    await this.prisma.$transaction(async (tx) => {
      for (const target of dispatchable) {
        const owner = target.vehicle.ownerships[0]!.user;
        const channel = owner.email ? MessageChannel.EMAIL : MessageChannel.SMS;
        const message = await tx.outboundMessage.create({
          data: {
            channel,
            templateKey: 'CAMPAIGN_OFFER',
            recipient: owner.email ?? owner.phone!,
            payload: {
              fullName: owner.fullName,
              campaignTitle: campaign.publicTitle!,
              description: campaign.publicDescription!,
              model: target.vehicle.model,
              ctaLabel: campaign.publicCtaLabel ?? 'Abrir Ford App',
              ctaLink,
              expiresAt: campaign.endsAt.toISOString(),
            },
            userId: owner.id,
            campaignTargetId: target.id,
          },
        });
        messageIds.push(message.id);
        await tx.campaignTarget.update({ where: { id: target.id }, data: { sentAt } });
      }
      await tx.auditLog.create({
        data: {
          performedById: actor.userId,
          action: 'CAMPAIGN_DISPATCH',
          entityType: 'Campaign',
          entityId: id,
          metadata: { sent: dispatchable.length, skipped: pendingTargets.length - dispatchable.length, messageIds },
        },
      });
    });
    for (const messageId of messageIds) {
      this.messaging.deliverNow(messageId).catch(() => undefined);
    }
    return { campaignId: id, sent: dispatchable.length, skipped: pendingTargets.length - dispatchable.length, sentAt };
  }
}
