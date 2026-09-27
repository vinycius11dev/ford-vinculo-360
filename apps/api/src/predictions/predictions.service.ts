import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AiRecommendationDecision, Prisma, UserRole, VoucherStatus } from '@prisma/client';
import { AuthenticatedUser } from '../auth/auth.types';
import { PrismaService } from '../prisma/prisma.service';
import { ChurnFeaturesDto } from './dto/churn-features.dto';
import { ReviewRecommendationDto } from './dto/review-recommendation.dto';

type ChurnResult = {
  probability: number;
  classification: 'ACTIVE' | 'ATTENTION' | 'AT_RISK' | 'LOST';
  reasons: string[];
  model_version: string;
  source: string;
};

@Injectable()
export class PredictionsService {
  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  private payload(input: ChurnFeaturesDto) {
    return { days_since_last_service: input.daysSinceLastService, services_last_24_months: input.servicesLast24Months, vehicle_age_years: input.vehicleAgeYears, voucher_usage_count: input.voucherUsageCount };
  }

  private fallback(input: ChurnFeaturesDto): ChurnResult {
    const raw = -2.4 + .008 * input.daysSinceLastService - .35 * Math.min(input.servicesLast24Months, 6) + .12 * input.vehicleAgeYears - .18 * Math.min(input.voucherUsageCount, 5);
    const probability = Math.round((1 / (1 + Math.exp(-raw))) * 10000) / 10000;
    const classification = probability >= .8 ? 'LOST' : probability >= .55 ? 'AT_RISK' : probability >= .3 ? 'ATTENTION' : 'ACTIVE';
    const reasons = input.daysSinceLastService > 730 ? ['mais de 2 anos sem serviço registrado'] : input.daysSinceLastService > 365 ? ['retorno anual vencido'] : input.daysSinceLastService > 240 ? ['revisão recomendada nos próximos meses'] : ['histórico de manutenção dentro do esperado'];
    return { probability, classification, reasons, model_version: 'heuristic-fallback-v1', source: 'api-fallback' };
  }

  async churn(input: ChurnFeaturesDto): Promise<ChurnResult> {
    try {
      const response = await fetch(`${this.config.get('ML_SERVICE_URL') ?? 'http://127.0.0.1:8000'}/score/churn`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(this.payload(input)), signal: AbortSignal.timeout(3000) });
      if (!response.ok) throw new Error('ML indisponível');
      return await response.json() as ChurnResult;
    } catch {
      return this.fallback(input);
    }
  }

  /** Uma chamada para a carteira inteira: evita N requisições por tela. */
  async churnBatch(inputs: ChurnFeaturesDto[]): Promise<ChurnResult[]> {
    if (!inputs.length) return [];
    try {
      const response = await fetch(`${this.config.get('ML_SERVICE_URL') ?? 'http://127.0.0.1:8000'}/score/churn/batch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: inputs.map((input) => this.payload(input)) }),
        signal: AbortSignal.timeout(5000),
      });
      if (!response.ok) throw new Error('ML indisponível');
      const body = await response.json() as { items?: ChurnResult[] };
      if (!body.items || body.items.length !== inputs.length) throw new Error('Resposta de ML inválida');
      return body.items;
    } catch {
      return inputs.map((input) => this.fallback(input));
    }
  }

  private async featuresFor(vehicle: {
    manufactureYear: number;
    serviceOrders: { completedAt: Date | null }[];
    ownerships: { userId: string; startedAt: Date }[];
  }): Promise<ChurnFeaturesDto & { ownerId?: string }> {
    const ownerId = vehicle.ownerships[0]?.userId;
    const completions = vehicle.serviceOrders
      .map((order) => order.completedAt)
      .filter((date): date is Date => date !== null)
      .sort((a, b) => b.getTime() - a.getTime());
    const now = Date.now();
    const relationshipStartedAt = vehicle.ownerships[0]?.startedAt;
    // Sem revisão não significa abandono: em um veículo recém-entregue, o
    // tempo de relacionamento é a referência até a primeira revisão.
    const referenceDate = completions[0] ?? relationshipStartedAt;
    const daysSinceLastService = referenceDate
      ? Math.max(0, Math.floor((now - referenceDate.getTime()) / 86_400_000))
      : 0;
    const twoYearsAgo = new Date(now - 730 * 86_400_000);
    const servicesLast24Months = completions.filter((date) => date >= twoYearsAgo).length;
    const vehicleAgeYears = Math.max(0, new Date().getFullYear() - vehicle.manufactureYear);
    const voucherUsageCount = ownerId
      ? await this.prisma.voucher.count({
          where: { status: VoucherStatus.REDEEMED, loyaltyAccount: { userId: ownerId } },
        })
      : 0;
    return { daysSinceLastService, servicesLast24Months, vehicleAgeYears, voucherUsageCount, ownerId };
  }

  async churnForVehicle(vin: string, actor: AuthenticatedUser) {
    const visibility: Prisma.VehicleWhereInput = actor.role === UserRole.FORD_ADMIN
      ? {}
      : actor.role === UserRole.CUSTOMER
        ? { ownerships: { some: { userId: actor.userId, status: 'ACTIVE' } } }
        : {
            OR: [
              { originDealershipId: actor.dealershipId ?? '__none__' },
              { serviceOrders: { some: { dealershipId: actor.dealershipId ?? '__none__' } } },
            ],
          };
    const vehicle = await this.prisma.vehicle.findFirst({
      where: { vin: vin.toUpperCase(), ...visibility },
      select: {
        id: true,
        manufactureYear: true,
        serviceOrders: { where: { status: 'COMPLETED' }, select: { completedAt: true } },
        ownerships: { where: { status: 'ACTIVE' }, take: 1, select: { userId: true, startedAt: true } },
      },
    });
    if (!vehicle) throw new NotFoundException('Veículo não encontrado.');

    const { ownerId: _owner, ...features } = await this.featuresFor(vehicle);
    const result = await this.churn(features);
    return { ...result, features };
  }

  async churnForCustomers(actor: AuthenticatedUser) {
    const where =
      actor.role === UserRole.FORD_ADMIN
        ? {}
        : {
            OR: [
              { originDealershipId: actor.dealershipId ?? '__none__' },
              { serviceOrders: { some: { dealershipId: actor.dealershipId ?? '__none__' } } },
            ],
          };
    const vehicles = await this.prisma.vehicle.findMany({
      where: { ...where, ownerships: { some: { status: 'ACTIVE' } } },
      select: {
        vin: true,
        manufactureYear: true,
        serviceOrders: { where: { status: 'COMPLETED' }, select: { completedAt: true } },
        ownerships: { where: { status: 'ACTIVE' }, take: 1, select: { userId: true, startedAt: true } },
      },
      take: 200,
    });
    return Promise.all(
      vehicles.map(async (vehicle) => {
        const { ownerId, ...features } = await this.featuresFor(vehicle);
        const result = await this.churn(features);
        return { vin: vehicle.vin, userId: ownerId, ...result };
      }),
    );
  }

  /**
   * Registra a decisão da pessoa responsável. O resultado de IA é congelado
   * junto da revisão para que a trilha explique qual versão sugeriu a ação.
   */
  async reviewRecommendation(
    vin: string,
    input: ReviewRecommendationDto,
    actor: AuthenticatedUser,
  ) {
    if (actor.role === UserRole.CUSTOMER) {
      throw new ForbiddenException('A revisão de recomendações é exclusiva da equipe interna.');
    }
    const internalScope = actor.role === UserRole.FORD_ADMIN
      ? {}
      : {
          OR: [
            { originDealershipId: actor.dealershipId ?? '__none__' },
            { serviceOrders: { some: { dealershipId: actor.dealershipId ?? '__none__' } } },
          ],
        };
    const vehicle = await this.prisma.vehicle.findFirst({
      where: {
        vin: vin.toUpperCase(),
        ownerships: { some: { status: 'ACTIVE' } },
        ...internalScope,
      },
      select: {
        id: true,
        vin: true,
        manufactureYear: true,
        serviceOrders: { where: { status: 'COMPLETED' }, select: { completedAt: true } },
        ownerships: { where: { status: 'ACTIVE' }, take: 1, select: { userId: true, startedAt: true } },
      },
    });
    if (!vehicle) throw new NotFoundException('Veículo não encontrado ou fora do seu acesso.');

    const { ownerId: _ownerId, ...features } = await this.featuresFor(vehicle);
    const prediction = await this.churn(features);
    const reason = (input.reason ?? input.notes)?.trim() || null;
    const review = await this.prisma.$transaction(async (tx) => {
      const saved = await tx.aiRecommendationReview.upsert({
        where: {
          vehicleId_modelVersion: {
            vehicleId: vehicle.id,
            modelVersion: prediction.model_version,
          },
        },
        create: {
          vehicleId: vehicle.id,
          reviewedById: actor.userId,
          decision: input.decision,
          reason,
          score: Math.round(prediction.probability * 100),
          classification: prediction.classification,
          modelVersion: prediction.model_version,
          modelSource: prediction.source,
        },
        update: {
          reviewedById: actor.userId,
          decision: input.decision,
          reason,
          score: Math.round(prediction.probability * 100),
          classification: prediction.classification,
          modelSource: prediction.source,
          reviewedAt: new Date(),
        },
      });
      await tx.auditLog.create({
        data: {
          performedById: actor.userId,
          action: input.decision === AiRecommendationDecision.APPROVED
            ? 'AI_RECOMMENDATION_APPROVED'
            : 'AI_RECOMMENDATION_DISMISSED',
          entityType: 'AiRecommendationReview',
          entityId: saved.id,
          metadata: {
            vin: vehicle.vin,
            vehicleId: vehicle.id,
            decision: input.decision,
            reason,
            score: saved.score,
            classification: saved.classification,
            modelVersion: saved.modelVersion,
            modelSource: saved.modelSource,
            features,
          },
        },
      });
      return saved;
    });
    return review;
  }
}
