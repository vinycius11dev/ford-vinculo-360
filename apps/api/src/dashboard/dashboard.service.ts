import { Injectable } from "@nestjs/common";
import { Prisma, UserRole } from "@prisma/client";
import { AuthenticatedUser } from "../auth/auth.types";
import { PredictionsService } from "../predictions/predictions.service";
import { PrismaService } from "../prisma/prisma.service";

type ChallengeQuery = Record<string, string | undefined>;

const ageBucketFor = (modelYear: number, year: number) => {
  const age = Math.max(0, year - modelYear);
  if (age <= 2) return "<3 anos";
  if (age <= 5) return "3–5 anos";
  if (age <= 8) return "6–8 anos";
  return "9+ anos";
};

const serviceTypeFor = (description: string | null) => {
  const value = (description ?? "").toLocaleLowerCase("pt-BR");
  if (value.includes("recall") || value.includes("campanha")) return "Recall e segurança";
  if (value.includes("acessório") || value.includes("acessorio")) return "Acessórios";
  if (value.includes("diagnóstico") || value.includes("diagnostico")) return "Diagnóstico";
  if (value.includes("alinhamento") || value.includes("balanceamento") || value.includes("pneu")) return "Pneus e alinhamento";
  return "Revisão e manutenção";
};

const geographyFor = (state: string) => ({
  country: "Brasil",
  region: ["SP", "RJ", "ES", "MG"].includes(state) ? "Sudeste" : ["PR", "SC", "RS"].includes(state) ? "Sul" : ["BA", "PE", "CE", "AL"].includes(state) ? "Nordeste" : "Outras regiões",
});

const percent = (part: number, total: number) => total ? Math.round((part / total) * 1000) / 10 : 0;

const parseDate = (value: string | undefined, fallback: Date) => {
  if (!value) return fallback;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(parsed.getTime()) ? fallback : parsed;
};

@Injectable()
export class DashboardService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly predictions: PredictionsService,
  ) {}
  async summary(actor: AuthenticatedUser) {
    // A carteira é o que está na mão de clientes: veículo em estoque não tem
    // proprietário e não entra em retenção, risco nem VIN Share.
    const owned: Prisma.VehicleWhereInput = {
      ownerships: { some: { status: "ACTIVE" } },
    };
    const vehicleWhere: Prisma.VehicleWhereInput =
      actor.role === UserRole.CUSTOMER
        ? { ownerships: { some: { userId: actor.userId, status: "ACTIVE" } } }
        : actor.role === UserRole.FORD_ADMIN
          ? owned
          : {
              ...owned,
              OR: [
                { originDealershipId: actor.dealershipId ?? "__none__" },
                {
                  serviceOrders: {
                    some: { dealershipId: actor.dealershipId ?? "__none__" },
                  },
                },
              ],
            };
    const orderWhere: Prisma.ServiceOrderWhereInput =
      actor.role === UserRole.CUSTOMER
        ? { vehicle: vehicleWhere }
        : actor.role === UserRole.FORD_ADMIN
          ? {}
          : { dealershipId: actor.dealershipId ?? "__none__" };
    const bookingWhere: Prisma.BookingWhereInput =
      actor.role === UserRole.CUSTOMER
        ? { userId: actor.userId }
        : actor.role === UserRole.FORD_ADMIN
          ? {}
          : { dealershipId: actor.dealershipId ?? "__none__" };
    const now = new Date();
    const next30Days = new Date(now);
    next30Days.setDate(next30Days.getDate() + 30);
    const twelveMonthsAgo = new Date(now);
    twelveMonthsAgo.setFullYear(twelveMonthsAgo.getFullYear() - 1);
    const [
      vehicles,
      activeOrders,
      upcomingBookings,
      completedLastYear,
      points,
      campaignCount,
      completedServiceDates,
      retainedVehicles,
      serviceRevenue,
      salesRevenue,
    ] = await Promise.all([
      this.prisma.vehicle.findMany({
        where: vehicleWhere,
        select: {
          id: true,
          currentMileage: true,
          updatedAt: true,
          serviceOrders: {
            where: { status: "COMPLETED" },
            orderBy: { completedAt: "desc" },
            take: 1,
            select: { completedAt: true, mileage: true },
          },
          ownerships: {
            where: { status: "ACTIVE" },
            take: 1,
            select: { startedAt: true },
          },
        },
      }),
      this.prisma.serviceOrder.count({
        where: { ...orderWhere, status: { in: ["OPEN", "IN_PROGRESS"] } },
      }),
      this.prisma.booking.count({
        where: {
          ...bookingWhere,
          requestedFor: { gte: now, lte: next30Days },
          status: { in: ["REQUESTED", "CONFIRMED"] },
        },
      }),
      this.prisma.serviceOrder.count({
        where: {
          ...orderWhere,
          status: "COMPLETED",
          completedAt: { gte: twelveMonthsAgo },
        },
      }),
      this.prisma.pointTransaction.aggregate({
        where:
          actor.role === UserRole.CUSTOMER
            ? { loyaltyAccount: { userId: actor.userId } }
            : {},
        _sum: { amount: true },
      }),
      this.prisma.campaign.count({
        where: { active: true, startsAt: { lte: now }, endsAt: { gte: now } },
      }),
      this.prisma.serviceOrder.findMany({
        where: {
          ...orderWhere,
          status: "COMPLETED",
          completedAt: { gte: twelveMonthsAgo },
        },
        select: { completedAt: true },
      }),
      // Veículos distintos que voltaram à rede nos últimos 12 meses.
      this.prisma.vehicle.count({
        where: {
          ...vehicleWhere,
          serviceOrders: {
            some: {
              ...(actor.role === UserRole.DEALERSHIP_AGENT ||
              actor.role === UserRole.DEALERSHIP_MANAGER
                ? { dealershipId: actor.dealershipId ?? "__none__" }
                : {}),
              status: "COMPLETED",
              completedAt: { gte: twelveMonthsAgo },
            },
          },
        },
      }),
      // Receita de pós-venda dos últimos 12 meses.
      this.prisma.serviceOrder.aggregate({
        where: {
          ...orderWhere,
          status: "COMPLETED",
          completedAt: { gte: twelveMonthsAgo },
        },
        _sum: { amount: true },
        _count: { amount: true },
      }),
      // Receita de veículos vendidos no mesmo período.
      this.prisma.sale.aggregate({
        where: {
          ...(actor.role === UserRole.CUSTOMER
            ? { customerId: actor.userId }
            : actor.role === UserRole.FORD_ADMIN
              ? {}
              : { dealershipId: actor.dealershipId ?? "__none__" }),
          soldAt: { gte: twelveMonthsAgo },
        },
        _sum: { price: true },
        _count: true,
      }),
    ]);
    const risk = { active: 0, attention: 0, atRisk: 0, lost: 0 };
    for (const vehicle of vehicles) {
      const last = vehicle.serviceOrders[0]?.completedAt;
      const relationshipStartedAt = vehicle.ownerships[0]?.startedAt ?? null;
      // Veículo recém-entregue ainda não tem uma revisão concluída. Usar
      // "9999 dias" nesse caso o classificava indevidamente como perdido.
      const referenceDate = last ?? relationshipStartedAt;
      const days = referenceDate
        ? Math.max(0, Math.floor((now.getTime() - referenceDate.getTime()) / 86400000))
        : 0;
      if (days > 730) risk.lost += 1;
      else if (days > 365) risk.atRisk += 1;
      else if (days > 240) risk.attention += 1;
      else risk.active += 1;
    }
    // Retenção = veículos que voltaram à rede nos últimos 12 meses sobre a
    // carteira monitorada. Nunca ultrapassa 100%, mesmo com vários serviços
    // por veículo no período.
    const retention = vehicles.length
      ? Math.round((retainedVehicles / vehicles.length) * 1000) / 10
      : 0;
    const monthLabels = [
      "Jan",
      "Fev",
      "Mar",
      "Abr",
      "Mai",
      "Jun",
      "Jul",
      "Ago",
      "Set",
      "Out",
      "Nov",
      "Dez",
    ];
    const monthlyServices = Array.from({ length: 12 }, (_, index) => {
      const date = new Date(now.getFullYear(), now.getMonth() - 11 + index, 1);
      return {
        year: date.getFullYear(),
        month: date.getMonth(),
        label: monthLabels[date.getMonth()],
        value: 0,
      };
    });
    for (const service of completedServiceDates) {
      if (!service.completedAt) continue;
      const bucket = monthlyServices.find(
        (item) =>
          item.year === service.completedAt!.getFullYear() &&
          item.month === service.completedAt!.getMonth(),
      );
      if (bucket) bucket.value += 1;
    }
    return {
      vehicles: vehicles.length,
      activeOrders,
      upcomingBookings,
      completedLastYear,
      retention,
      risk,
      pointsInCirculation: points._sum.amount ?? 0,
      activeCampaigns: campaignCount,
      revenue: {
        service: serviceRevenue._sum.amount ?? 0,
        sales: salesRevenue._sum.price ?? 0,
        vehiclesSold: salesRevenue._count ?? 0,
        // Ticket médio de pós-venda: base para medir o retorno de cada
        // cliente recuperado.
        averageServiceTicket: serviceRevenue._count.amount
          ? Math.round(
              (serviceRevenue._sum.amount ?? 0) / serviceRevenue._count.amount,
            )
          : 0,
      },
      monthlyServices: monthlyServices.map(({ label, value }) => ({
        label,
        value,
      })),
      generatedAt: now,
    };
  }

  async repurchase(_actor: AuthenticatedUser) {
    // Oportunidade de recompra pressupõe um proprietário; estoque não entra.
    const owned: Prisma.VehicleWhereInput = {
      ownerships: { some: { status: "ACTIVE" } },
    };
    // Recompra é uma fila comercial compartilhada: todos os perfis internos
    // enxergam a mesma carteira nacional e podem acompanhar qualquer oportunidade.
    const where: Prisma.VehicleWhereInput = owned;
    const vehicles = await this.prisma.vehicle.findMany({
      where,
      include: {
        ownerships: {
          where: { status: "ACTIVE" },
          take: 1,
          select: {
            user: {
              select: { id: true, fullName: true, phone: true, email: true },
            },
          },
        },
        serviceOrders: { where: { status: "COMPLETED" }, select: { id: true } },
      },
      take: 250,
    });
    return vehicles
      .map((vehicle) => {
        const age = Math.max(0, new Date().getFullYear() - vehicle.modelYear);
        const score = Math.min(
          98,
          Math.round(
            age * 11 +
              vehicle.currentMileage / 1800 +
              vehicle.serviceOrders.length * 3,
          ),
        );
        const estimatedValue = Math.max(
          35000,
          Math.round(
            (220000 - age * 22000 - vehicle.currentMileage * 0.45) / 1000,
          ) * 1000,
        );
        return {
          vin: vehicle.vin,
          model: vehicle.model,
          modelYear: vehicle.modelYear,
          currentMileage: vehicle.currentMileage,
          imageUrl: vehicle.imageUrl,
          owner: vehicle.ownerships[0]?.user ?? null,
          completedServices: vehicle.serviceOrders.length,
          score,
          estimatedValue,
        };
      })
      .sort((a, b) => b.score - a.score);
  }

  async admin() {
    const twelveMonthsAgo = new Date();
    twelveMonthsAgo.setFullYear(twelveMonthsAgo.getFullYear() - 1);
    const servicedInPeriod = {
      status: "COMPLETED" as const,
      completedAt: { gte: twelveMonthsAgo },
    };
    // Base monitorada nacionalmente = veículos com proprietário ativo.
    const owned = { ownerships: { some: { status: "ACTIVE" as const } } };
    const [vehicles, users, dealerships, services, models, retainedVehicles] =
      await Promise.all([
        this.prisma.vehicle.count({ where: owned }),
        this.prisma.user.count({ where: { role: "CUSTOMER" } }),
        this.prisma.dealership.findMany({
          select: {
            id: true,
            tradeName: true,
            city: true,
            state: true,
            _count: { select: { vehiclesSold: true, serviceOrders: true } },
          },
        }),
        this.prisma.serviceOrder.count({ where: { status: "COMPLETED" } }),
        this.prisma.vehicle.findMany({ where: owned, select: { model: true } }),
        this.prisma.vehicle.count({
          where: { ...owned, serviceOrders: { some: servicedInPeriod } },
        }),
      ]);
    // VIN Share = veículos que permaneceram no ecossistema (voltaram à rede
    // nos últimos 12 meses) sobre a base monitorada.
    const retentionByDealership = await Promise.all(
      dealerships.map(async (item) => {
        const [portfolio, retained] = await Promise.all([
          this.prisma.vehicle.count({
            where: { ...owned, originDealershipId: item.id },
          }),
          this.prisma.vehicle.count({
            where: {
              ...owned,
              originDealershipId: item.id,
              serviceOrders: { some: servicedInPeriod },
            },
          }),
        ]);
        return { id: item.id, portfolio, retained };
      }),
    );
    return {
      vehicles,
      customers: users,
      completedServices: services,
      vinShare: vehicles
        ? Math.round((retainedVehicles / vehicles) * 1000) / 10
        : 0,
      dealerships: dealerships
        .map((item) => {
          const entry = retentionByDealership.find(
            (record) => record.id === item.id,
          );
          const portfolio = entry?.portfolio ?? 0;
          return {
            ...item,
            _count: { ...item._count, vehiclesSold: portfolio },
            retention: portfolio
              ? Math.round(((entry?.retained ?? 0) / portfolio) * 1000) / 10
              : 0,
          };
        })
        .sort((a, b) => b.retention - a.retention),
      // Agrupado por família (Ranger, Territory, Maverick, Bronco), e não por
      // versão, que é como a linha é acompanhada comercialmente.
      models: Object.entries(
        models.reduce<Record<string, number>>((families, item) => {
          const family = item.model.split(" ")[0];
          families[family] = (families[family] ?? 0) + 1;
          return families;
        }, {}),
      )
        .map(([model, vehicles]) => ({ model, vehicles }))
        .sort((a, b) => b.vehicles - a.vehicles),
    };
  }

  async challenge(actor: AuthenticatedUser, query: ChallengeQuery) {
    const now = new Date();
    const defaultFrom = new Date(now);
    defaultFrom.setFullYear(defaultFrom.getFullYear() - 1);
    const from = parseDate(query.from, defaultFrom);
    const to = parseDate(query.to, now);
    const actorDealershipId = actor.role === UserRole.DEALERSHIP_AGENT || actor.role === UserRole.DEALERSHIP_MANAGER
      ? actor.dealershipId ?? "__none__"
      : undefined;
    const selectedDealershipId = actorDealershipId ?? query.dealershipId;
    const visibility: Prisma.VehicleWhereInput[] = [];
    if (actorDealershipId) {
      visibility.push({ OR: [
        { originDealershipId: actorDealershipId },
        { serviceOrders: { some: { dealershipId: actorDealershipId } } },
      ] });
    }
    if (selectedDealershipId) {
      visibility.push({ OR: [
        { originDealershipId: selectedDealershipId },
        { serviceOrders: { some: { dealershipId: selectedDealershipId } } },
      ] });
    }
    const scopeWhere: Prisma.VehicleWhereInput = {
      ownerships: { some: { status: "ACTIVE" } },
      ...(visibility.length ? { AND: visibility } : {}),
    };
    const serviceWhere: Prisma.ServiceOrderWhereInput = {
      status: "COMPLETED",
      completedAt: { gte: from, lte: to },
      ...(selectedDealershipId ? { dealershipId: selectedDealershipId } : {}),
    };
    const [scopeVehicles, dealerships, riskHistory] = await Promise.all([
      this.prisma.vehicle.findMany({
        where: scopeWhere,
        select: {
          id: true,
          vin: true,
          model: true,
          modelYear: true,
          currentMileage: true,
          warrantyUntil: true,
          originDealershipId: true,
          originDealership: { select: { id: true, tradeName: true, city: true, state: true } },
          ownerships: {
            where: { status: "ACTIVE" },
            take: 1,
            select: { startedAt: true, user: { select: { fullName: true } } },
          },
          serviceOrders: {
            where: serviceWhere,
            orderBy: { completedAt: "asc" },
            select: {
              id: true,
              description: true,
              amount: true,
              completedAt: true,
              dealership: { select: { id: true, tradeName: true, city: true, state: true } },
            },
          },
        },
      }),
      this.prisma.dealership.findMany({
        where: actorDealershipId ? { id: actorDealershipId } : undefined,
        select: { id: true, tradeName: true, city: true, state: true },
        orderBy: { tradeName: "asc" },
      }),
      this.prisma.serviceOrder.findMany({
        where: { status: "COMPLETED", vehicle: scopeWhere },
        select: { vehicleId: true, completedAt: true },
      }),
    ]);
    const riskHistoryByVehicle = new Map<string, Date[]>();
    for (const order of riskHistory) {
      if (!order.completedAt) continue;
      const entries = riskHistoryByVehicle.get(order.vehicleId) ?? [];
      entries.push(order.completedAt);
      riskHistoryByVehicle.set(order.vehicleId, entries);
    }
    const visibleDealershipIds = new Set(
      dealerships
        .filter((dealership) => {
          const geography = geographyFor(dealership.state);
          return (!query.country || geography.country === query.country) && (!query.region || geography.region === query.region);
        })
        .map((dealership) => dealership.id),
    );
    const year = now.getFullYear();
    const enriched = scopeVehicles.map((vehicle) => ({
      ...vehicle,
      age: Math.max(0, year - vehicle.modelYear),
      ageBucket: ageBucketFor(vehicle.modelYear, year),
      riskHistory: riskHistoryByVehicle.get(vehicle.id) ?? [],
      orders: vehicle.serviceOrders.map((order) => ({
        ...order,
        serviceType: serviceTypeFor(order.description),
      })),
    }));
    const filtered = enriched
      .map((vehicle) => ({
        ...vehicle,
        orders: query.serviceType
          ? vehicle.orders.filter((order) => order.serviceType === query.serviceType)
          : vehicle.orders,
      }))
      .filter((vehicle) => {
      if (query.model && vehicle.model !== query.model) return false;
      if (query.ageBucket && vehicle.ageBucket !== query.ageBucket) return false;
      if (query.serviceType && !vehicle.orders.length) return false;
      if ((query.country || query.region) && !(
        (vehicle.originDealershipId && visibleDealershipIds.has(vehicle.originDealershipId)) ||
        vehicle.orders.some((order) => visibleDealershipIds.has(order.dealership.id))
      )) return false;
      return true;
      });
    const baselineServices = enriched.reduce(
      (total, vehicle) => total + (query.serviceType
        ? vehicle.orders.filter((order) => order.serviceType === query.serviceType).length
        : vehicle.orders.length),
      0,
    );
    const filteredServices = filtered.reduce((total, vehicle) => total + vehicle.orders.length, 0);
    const servicedVins = filtered.filter((vehicle) => vehicle.orders.length > 0).length;
    const twoYearsAgo = new Date(now.getTime() - 730 * 86_400_000);
    const riskInputs = filtered.map((vehicle) => {
      const history = [...vehicle.riskHistory].sort((a, b) => b.getTime() - a.getTime());
      const lastService = history[0] ?? null;
      const relationshipStartedAt = vehicle.ownerships[0]?.startedAt ?? null;
      const referenceDate = lastService ?? relationshipStartedAt;
      return {
        daysSinceLastService: referenceDate
          ? Math.max(0, Math.floor((now.getTime() - referenceDate.getTime()) / 86_400_000))
          : 0,
        servicesLast24Months: history.filter((date) => date >= twoYearsAgo).length,
        vehicleAgeYears: vehicle.age,
        // A ausência de uso é conservadora. A próxima evolução pode agregar a
        // fidelidade por proprietário sem enviar PII ao serviço de previsão.
        voucherUsageCount: 0,
      };
    });
    const riskScores = await this.predictions.churnBatch(riskInputs);
    // A decisão humana fica associada à versão que produziu a sugestão. Se a
    // versão do modelo mudar, o lead volta para "aguarda revisão".
    const reviewRows = filtered.length
      ? await this.prisma.aiRecommendationReview.findMany({
          where: { vehicleId: { in: filtered.map((vehicle) => vehicle.id) } },
          select: {
            vehicleId: true,
            modelVersion: true,
            decision: true,
            reason: true,
            score: true,
            reviewedAt: true,
            reviewedBy: { select: { fullName: true } },
          },
          orderBy: { reviewedAt: 'desc' },
        })
      : [];
    const reviewByVehicleAndModel = new Map<string, typeof reviewRows[number]>();
    for (const review of reviewRows) {
      const key = `${review.vehicleId}:${review.modelVersion}`;
      if (!reviewByVehicleAndModel.has(key)) reviewByVehicleAndModel.set(key, review);
    }
    const leadRows = filtered.map((vehicle, index) => {
      const prediction = riskScores[index];
      const lastService = [...vehicle.riskHistory].sort((a, b) => b.getTime() - a.getTime())[0] ?? null;
      const customerName = vehicle.ownerships[0]?.user.fullName ?? "Cliente não identificado";
      const score = Math.round(prediction.probability * 100);
      const relationshipStartedAt = vehicle.ownerships[0]?.startedAt ?? null;
      const isNewRelationship = !lastService && relationshipStartedAt
        ? Math.floor((now.getTime() - relationshipStartedAt.getTime()) / 86_400_000) <= 180
        : false;
      const reason = isNewRelationship
        ? "veículo em período de primeira revisão"
        : prediction.reasons[0] ?? "Análise preventiva de manutenção";
      const nextAction = prediction.classification === "LOST" ? "Contato de recuperação" : prediction.classification === "AT_RISK" ? "Oferecer revisão" : prediction.classification === "ATTENTION" ? "Enviar lembrete" : "Manter relacionamento";
      const returnStatus = isNewRelationship
        ? "Veículo novo na rede; primeira revisão ainda não está vencida."
        : lastService
        ? `Não retornou à rede desde ${lastService.toLocaleDateString("pt-BR")}.`
        : "Ainda não possui retorno à rede registrado.";
      const review = reviewByVehicleAndModel.get(`${vehicle.id}:${prediction.model_version}`);
      return {
        vin: vehicle.vin,
        model: vehicle.model,
        age: vehicle.age,
        customerName,
        returnStatus,
        score,
        reason,
        nextAction,
        lastService,
        modelVersion: prediction.model_version,
        modelSource: prediction.source,
        governance: review
          ? {
              decision: review.decision,
              reason: review.reason,
              reviewedAt: review.reviewedAt,
              reviewedBy: review.reviewedBy.fullName,
            }
          : { decision: 'PENDING', reason: null, reviewedAt: null, reviewedBy: null },
      };
    }).filter((lead) => lead.score >= 52).sort((a, b) => b.score - a.score).slice(0, 8);
    const group = (keyFor: (vehicle: typeof enriched[number]) => string) => {
      const map = new Map<string, { label: string; eligibleVins: number; servicedVins: Set<string>; services: number }>();
      for (const vehicle of filtered) {
        const label = keyFor(vehicle);
        const entry = map.get(label) ?? { label, eligibleVins: 0, servicedVins: new Set<string>(), services: 0 };
        entry.eligibleVins += 1;
        if (vehicle.orders.length) entry.servicedVins.add(vehicle.vin);
        entry.services += vehicle.orders.length;
        map.set(label, entry);
      }
      return [...map.values()].map((entry) => ({ label: entry.label, eligibleVins: entry.eligibleVins, servicedVins: entry.servicedVins.size, vinShare: percent(entry.servicedVins.size, entry.eligibleVins), services: entry.services, serviceShare: percent(entry.services, baselineServices) })).sort((a, b) => b.services - a.services || b.vinShare - a.vinShare);
    };
    const serviceTypeMap = new Map<string, { label: string; servicedVins: Set<string>; services: number }>();
    for (const vehicle of filtered) for (const order of vehicle.orders) {
      const entry = serviceTypeMap.get(order.serviceType) ?? { label: order.serviceType, servicedVins: new Set<string>(), services: 0 };
      entry.servicedVins.add(vehicle.vin);
      entry.services += 1;
      serviceTypeMap.set(order.serviceType, entry);
    }
    const monthCount = Math.max(1, Math.min(12,
      (to.getFullYear() - from.getFullYear()) * 12 + to.getMonth() - from.getMonth(),
    ));
    const trend = Array.from({ length: monthCount }, (_, index) => {
      const date = new Date(to.getFullYear(), to.getMonth() - monthCount + 1 + index, 1);
      const next = new Date(date.getFullYear(), date.getMonth() + 1, 1);
      const monthVehicles = filtered.filter((vehicle) => vehicle.orders.some((order) => order.completedAt && new Date(order.completedAt) >= date && new Date(order.completedAt) < next));
      const services = filtered.reduce((total, vehicle) => total + vehicle.orders.filter((order) => order.completedAt && new Date(order.completedAt) >= date && new Date(order.completedAt) < next).length, 0);
      return { label: date.toLocaleDateString("pt-BR", { month: "short" }).replace(".", ""), vinShare: percent(monthVehicles.length, filtered.length), services };
    });
    const dealerRows = dealerships.map((dealer) => {
      const dealerVehicles = filtered.filter((vehicle) => vehicle.originDealershipId === dealer.id || vehicle.orders.some((order) => order.dealership.id === dealer.id));
      const dealerOrders = dealerVehicles.flatMap((vehicle) => vehicle.orders.filter((order) => order.dealership.id === dealer.id));
      return { id: dealer.id, tradeName: dealer.tradeName, city: dealer.city, state: dealer.state, eligibleVins: dealerVehicles.length, servicedVins: new Set(dealerOrders.map((order) => dealerVehicles.find((vehicle) => vehicle.orders.includes(order))?.vin)).size, vinShare: percent(new Set(dealerOrders.map((order) => dealerVehicles.find((vehicle) => vehicle.orders.includes(order))?.vin)).size, dealerVehicles.length), services: dealerOrders.length, serviceShare: percent(dealerOrders.length, baselineServices) };
    }).filter((dealer) => dealer.eligibleVins || dealer.services);
    const campaignTargets = filtered.length
      ? await this.prisma.campaignTarget.findMany({
          where: {
            sentAt: { gte: from, lte: to },
            vehicle: { vin: { in: filtered.map((vehicle) => vehicle.vin) } },
          },
          select: {
            id: true,
            sentAt: true,
            viewedAt: true,
            convertedAt: true,
            campaign: { select: { id: true, name: true } },
            vehicle: {
              select: {
                vin: true,
                bookings: {
                  where: { createdAt: { gte: from, lte: to }, status: { not: "CANCELLED" } },
                  select: { status: true },
                },
                serviceOrders: {
                  where: { status: "COMPLETED", completedAt: { gte: from, lte: to } },
                  select: { id: true, amount: true },
                },
              },
            },
          },
          orderBy: { sentAt: "desc" },
        })
      : [];
    const scheduledCampaigns = campaignTargets.filter((target) => target.vehicle.bookings.length > 0).length;
    const completedCampaigns = campaignTargets.filter((target) => target.vehicle.serviceOrders.length > 0).length;
    const viewedCampaigns = campaignTargets.filter((target) => target.viewedAt).length;
    const convertedCampaigns = campaignTargets.filter((target) => target.convertedAt).length;
    const pendingCampaigns = campaignTargets.filter((target) => !target.vehicle.bookings.length && !target.vehicle.serviceOrders.length && !target.convertedAt).length;
    const campaignPerformance = new Map<string, { id: string; name: string; sent: number; viewed: number; scheduled: number; completed: number; converted: number }>();
    for (const target of campaignTargets) {
      const entry = campaignPerformance.get(target.campaign.id) ?? { id: target.campaign.id, name: target.campaign.name, sent: 0, viewed: 0, scheduled: 0, completed: 0, converted: 0 };
      entry.sent += 1;
      if (target.viewedAt) entry.viewed += 1;
      if (target.vehicle.bookings.length) entry.scheduled += 1;
      if (target.vehicle.serviceOrders.length) entry.completed += 1;
      if (target.convertedAt) entry.converted += 1;
      campaignPerformance.set(target.campaign.id, entry);
    }
    const campaignSummary = {
      sent: campaignTargets.length,
      viewed: viewedCampaigns,
      converted: convertedCampaigns,
      scheduled: scheduledCampaigns,
      completed: completedCampaigns,
      pending: pendingCampaigns,
      conversionRate: percent(convertedCampaigns, campaignTargets.length),
      latest: campaignTargets[0]?.campaign.name ?? null,
      items: [...campaignPerformance.values()].sort((a, b) => b.sent - a.sent || b.converted - a.converted),
    };
    const serviceRevenue = filtered.reduce((total, vehicle) => total + vehicle.orders.reduce((sum, order) => sum + (order.amount ?? 0), 0), 0);
    const campaignRevenue = campaignTargets.reduce((total, target) => total + target.vehicle.serviceOrders.reduce((sum, order) => sum + (order.amount ?? 0), 0), 0);
    const recentServices = trend.slice(-3).reduce((total, item) => total + item.services, 0);
    const previousServices = trend.slice(0, -3).reduce((total, item) => total + item.services, 0);
    const alerts = [...(leadRows.length ? [{ tone: "amber", title: `${leadRows.length} veículos precisam de atenção`, description: "Priorize uma abordagem personalizada antes que deixem a rede." }] : [])];
    if (trend.length >= 6 && previousServices > 0 && recentServices === 0) {
      alerts.unshift({ tone: "red", title: "Queda de retorno no período recente", description: "Nenhum serviço foi concluído nos últimos três meses deste recorte. Investigue a carteira e acione uma campanha de recuperação." });
    } else if (trend.length >= 6 && previousServices > 0 && recentServices < previousServices / 2) {
      alerts.unshift({ tone: "amber", title: "Retorno abaixo da linha de base", description: "O volume recente está abaixo de 50% do histórico anterior. Priorize os segmentos com maior risco." });
    }
    return {
      period: { from: from.toISOString(), to: to.toISOString() },
      prediction: {
        modelVersion: riskScores[0]?.model_version ?? "sem-carteira",
        source: riskScores[0]?.source ?? "not-run",
        generatedAt: now.toISOString(),
        evaluatedVehicles: filtered.length,
      },
      definitions: {
        vinShare: "VINs únicos atendidos na rede no período ÷ VINs elegíveis do recorte",
        serviceShare: "ordens concluídas do recorte ÷ ordens concluídas da carteira no período",
      },
      kpis: {
        eligibleVins: filtered.length,
        servicedVins,
        vinShare: percent(servicedVins, filtered.length),
        completedServices: filteredServices,
        serviceShare: percent(filteredServices, baselineServices),
        leads: leadRows.length,
      },
      campaigns: campaignSummary,
      revenue: {
        service: serviceRevenue,
        campaign: campaignRevenue,
        averageTicket: filteredServices ? Math.round(serviceRevenue / filteredServices) : 0,
      },
      filters: {
        dealerships: dealerships.map((dealership) => ({ ...dealership, ...geographyFor(dealership.state) })),
        countries: [...new Set(dealerships.map((dealership) => geographyFor(dealership.state).country))].sort(),
        regions: [...new Set(dealerships.map((dealership) => geographyFor(dealership.state).region))].sort(),
        models: [...new Set(enriched.map((vehicle) => vehicle.model))].sort(),
        ageBuckets: [...new Set(enriched.map((vehicle) => vehicle.ageBucket))],
        serviceTypes: [...new Set(enriched.flatMap((vehicle) => vehicle.orders.map((order) => order.serviceType)))].sort(),
      },
      trend,
      dealerships: dealerRows,
      models: group((vehicle) => vehicle.model),
      ages: group((vehicle) => vehicle.ageBucket),
      serviceTypes: [...serviceTypeMap.values()].map((entry) => ({ label: entry.label, eligibleVins: filtered.length, servicedVins: entry.servicedVins.size, vinShare: percent(entry.servicedVins.size, filtered.length), services: entry.services, serviceShare: percent(entry.services, baselineServices) })).sort((a, b) => b.services - a.services),
      leads: leadRows,
      alerts,
    };
  }
}
