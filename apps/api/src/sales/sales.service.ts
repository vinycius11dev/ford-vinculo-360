import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import {
  MessageChannel,
  MessageStatus,
  NotificationType,
  OwnershipStatus,
  Prisma,
  RepurchaseLeadStatus,
  UserRole,
  VehicleCondition,
  VehicleSaleStatus,
} from "@prisma/client";
import { hash } from "bcryptjs";
import { createHash, randomBytes } from "node:crypto";
import { AuthenticatedUser } from "../auth/auth.types";
import { PrismaService } from "../prisma/prisma.service";
import { MessagingService } from "../messaging/messaging.service";
import { isValidCpf, onlyDigits } from "../users/dto/customer-profile.dto";
import { RegisterSaleDto } from "./dto/register-sale.dto";

@Injectable()
export class SalesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly messaging: MessagingService,
  ) {}

  private customerAppUrl() {
    return (this.config.get<string>("APP_CUSTOMER_APP_URL") ?? "http://localhost:8081").replace(/\/$/, "");
  }

  /** Estoque é sempre da unidade do usuário; a Ford enxerga a rede inteira. */
  private stockScope(actor: AuthenticatedUser): Prisma.VehicleWhereInput {
    return actor.role === UserRole.FORD_ADMIN
      ? {}
      : { stockDealershipId: actor.dealershipId ?? "__none__" };
  }

  private dealershipOf(actor: AuthenticatedUser, fallback?: string | null) {
    const dealershipId =
      actor.role === UserRole.FORD_ADMIN ? (fallback ?? null) : actor.dealershipId;
    if (!dealershipId)
      throw new BadRequestException(
        "Selecione a concessionária responsável pela operação.",
      );
    return dealershipId;
  }

  /** Impede faturar para uma empresa sem identificação e poderes conferidos. */
  private assertCompanyReadyForPurchase(customer: {
    customerType: string;
    companyRegistrationStatus: string | null;
    legalRepresentativeName: string | null;
    legalRepresentativeCpf: string | null;
    legalRepresentativeDocument: string | null;
    legalRepresentativeRole: string | null;
    representationBasis: string | null;
    representationDocumentChecked: boolean;
  }) {
    if (customer.customerType !== "COMPANY") return;
    const status = customer.companyRegistrationStatus
      ?.normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toUpperCase();
    if (status !== "ATIVA")
      throw new BadRequestException(
        "Consulte o CNPJ e confirme que a situação cadastral está ativa antes da venda.",
      );
    if (
      !customer.legalRepresentativeName ||
      !customer.legalRepresentativeCpf ||
      !isValidCpf(customer.legalRepresentativeCpf) ||
      !customer.legalRepresentativeDocument ||
      !customer.legalRepresentativeRole ||
      !customer.representationBasis ||
      !customer.representationDocumentChecked
    )
      throw new BadRequestException(
        "Complete e confira os dados do representante legal da empresa antes da venda.",
      );
  }

  async stock(actor: AuthenticatedUser) {
    const vehicles = await this.prisma.vehicle.findMany({
      where: {
        ...this.stockScope(actor),
        saleStatus: { in: [VehicleSaleStatus.IN_STOCK, VehicleSaleStatus.RESERVED] },
      },
      select: {
        vin: true,
        plate: true,
        model: true,
        version: true,
        exteriorColor: true,
        interiorColor: true,
        engine: true,
        fuelType: true,
        transmission: true,
        drive: true,
        power: true,
        doors: true,
        seats: true,
        features: true,
        imageUrl: true,
        modelYear: true,
        manufactureYear: true,
        currentMileage: true,
        condition: true,
        saleStatus: true,
        listPrice: true,
        stockSince: true,
        stockDealership: { select: { id: true, tradeName: true, city: true, state: true } },
        serviceOrders: {
          where: { status: "COMPLETED" },
          select: { id: true },
        },
      },
      orderBy: [{ condition: "asc" }, { stockSince: "asc" }],
      take: 200,
    });
    return vehicles.map(({ serviceOrders, ...vehicle }) => ({
      ...vehicle,
      // Usado com histórico na rede é argumento de venda: o VIN já conta a
      // própria procedência.
      serviceHistory: serviceOrders.length,
      daysInStock: vehicle.stockSince
        ? Math.floor((Date.now() - vehicle.stockSince.getTime()) / 86_400_000)
        : 0,
    }));
  }

  async history(actor: AuthenticatedUser) {
    return this.prisma.sale.findMany({
      where:
        actor.role === UserRole.FORD_ADMIN
          ? {}
          : { dealershipId: actor.dealershipId ?? "__none__" },
      include: {
        vehicle: { select: { vin: true, model: true, modelYear: true } },
        customer: { select: { id: true, fullName: true, email: true } },
        soldBy: { select: { fullName: true } },
        dealership: { select: { tradeName: true } },
        tradeInVehicle: { select: { vin: true, model: true } },
      },
      orderBy: { soldAt: "desc" },
      take: 100,
    });
  }

  async register(input: RegisterSaleDto, actor: AuthenticatedUser) {
    const vin = input.vin.toUpperCase();
    const vehicle = await this.prisma.vehicle.findUnique({ where: { vin } });
    if (!vehicle) throw new NotFoundException("Veículo não encontrado.");
    if (vehicle.saleStatus !== VehicleSaleStatus.IN_STOCK &&
        vehicle.saleStatus !== VehicleSaleStatus.RESERVED)
      throw new BadRequestException("Este veículo não está disponível para venda.");
    const dealershipId = this.dealershipOf(actor, vehicle.stockDealershipId);
    if (
      actor.role !== UserRole.FORD_ADMIN &&
      vehicle.stockDealershipId !== dealershipId
    )
      throw new BadRequestException("Este veículo está no estoque de outra unidade.");
    if (vehicle.listPrice === null)
      throw new BadRequestException("Cadastre o preço do veículo antes da venda.");
    const salePrice = vehicle.listPrice;

    if (!input.customerId && !input.customer)
      throw new BadRequestException(
        "Selecione um cliente ou informe os dados para cadastro.",
      );

    const tradeIn = input.tradeInVin
      ? await this.prisma.vehicle.findUnique({
          where: { vin: input.tradeInVin.toUpperCase() },
          include: {
            ownerships: { where: { status: OwnershipStatus.ACTIVE }, take: 1 },
          },
        })
      : null;
    if (input.tradeInVin && !tradeIn)
      throw new NotFoundException("Veículo da troca não encontrado.");

    const soldAt = new Date();
    const warrantyMonths = input.warrantyMonths ?? 36;
    const warrantyUntil = new Date(soldAt);
    warrantyUntil.setMonth(warrantyUntil.getMonth() + warrantyMonths);

    let activation: {
      userId: string;
      email: string;
      fullName: string;
      token: string;
      expiresAt: Date;
    } | null = null;
    const sale = await this.prisma.$transaction(async (tx) => {
      // Cadastro do cliente no ato da venda, quando ele ainda não existe.
      let customerId = input.customerId;
      if (!customerId && input.customer) {
        const email = input.customer.email.toLowerCase();
        const found = await tx.user.findUnique({ where: { email } });
        if (found) {
          if (found.role !== UserRole.CUSTOMER)
            throw new ConflictException(
              "Este e-mail pertence a um usuário interno da rede.",
            );
          customerId = found.id;
        } else {
          const cpf = input.customer.cpf
            ? onlyDigits(input.customer.cpf)
            : null;
          if (input.customer.cpf && !isValidCpf(input.customer.cpf))
            throw new BadRequestException("CPF inválido. Confira os dígitos.");
          if (cpf && (await tx.user.count({ where: { cpf } })))
            throw new ConflictException("Já existe um cliente com este CPF.");
          const created = await tx.user.create({
            data: {
              email,
              fullName: input.customer.fullName,
              phone: input.customer.phone,
              cpf,
              role: UserRole.CUSTOMER,
              registeredByDealershipId: dealershipId,
              // Primeiro acesso é definido pelo próprio cliente, pelo fluxo de
              // recuperação de senha. Nenhuma senha é compartilhada.
              passwordHash: await hash(randomBytes(24).toString("hex"), 12),
              active: false,
              passwordSetupRequired: true,
              loyalty: { create: {} },
            },
          });
          customerId = created.id;
        }
      }
      const customer = await tx.user.findUnique({ where: { id: customerId } });
      if (!customer || customer.role !== UserRole.CUSTOMER)
        throw new NotFoundException("Cliente não encontrado.");
      this.assertCompanyReadyForPurchase(customer);
      if (customer.passwordSetupRequired) {
        const token = randomBytes(32).toString("hex");
        const expiresAt = new Date(Date.now() + 72 * 60 * 60 * 1000);
        await tx.passwordResetToken.updateMany({
          where: { userId: customer.id, usedAt: null },
          data: { usedAt: new Date() },
        });
        await tx.passwordResetToken.create({
          data: {
            userId: customer.id,
            tokenHash: createHash("sha256").update(token).digest("hex"),
            expiresAt,
          },
        });
        activation = {
          userId: customer.id,
          email: customer.email,
          fullName: customer.fullName,
          token,
          expiresAt,
        };
      }
      await tx.loyaltyAccount.upsert({
        where: { userId: customer.id },
        update: {},
        create: { userId: customer.id },
      });

      // O vínculo anterior é encerrado e o histórico permanece no VIN.
      await tx.vehicleOwnership.updateMany({
        where: { vehicleId: vehicle.id, status: OwnershipStatus.ACTIVE },
        data: { status: OwnershipStatus.ENDED, endedAt: soldAt },
      });
      await tx.vehicleOwnership.create({
        data: {
          vehicleId: vehicle.id,
          userId: customer.id,
          status: OwnershipStatus.ACTIVE,
          startedAt: soldAt,
        },
      });
      await tx.vehicle.update({
        where: { id: vehicle.id },
        data: {
          saleStatus: VehicleSaleStatus.SOLD,
          stockDealershipId: null,
          stockSince: null,
          listPrice: null,
          warrantyUntil,
          originDealershipId: vehicle.originDealershipId ?? dealershipId,
        },
      });

      // O usado da troca entra no estoque carregando o próprio histórico.
      if (tradeIn) {
        await tx.vehicleOwnership.updateMany({
          where: { vehicleId: tradeIn.id, status: OwnershipStatus.ACTIVE },
          data: { status: OwnershipStatus.ENDED, endedAt: soldAt },
        });
        await tx.vehicle.update({
          where: { id: tradeIn.id },
          data: {
            condition: VehicleCondition.USED,
            saleStatus: VehicleSaleStatus.IN_STOCK,
            stockDealershipId: dealershipId,
            stockSince: soldAt,
            listPrice: input.tradeInValue ?? tradeIn.listPrice,
          },
        });
      }

      if (input.repurchaseLeadId) {
        const lead = await tx.repurchaseLead.findUnique({
          where: { id: input.repurchaseLeadId },
        });
        if (lead && lead.status !== RepurchaseLeadStatus.WON) {
          await tx.repurchaseLead.update({
            where: { id: lead.id },
            data: { status: RepurchaseLeadStatus.WON, closedAt: soldAt },
          });
          await tx.repurchaseLeadEvent.create({
            data: {
              leadId: lead.id,
              performedById: actor.userId,
              fromStatus: lead.status,
              toStatus: RepurchaseLeadStatus.WON,
              notes: `Venda registrada: ${vehicle.model} ${vehicle.modelYear}.`,
            },
          });
        }
      }

      const sale = await tx.sale.create({
        data: {
          vehicleId: vehicle.id,
          dealershipId,
          customerId: customer.id,
          soldById: actor.userId,
          tradeInVehicleId: tradeIn?.id ?? null,
          repurchaseLeadId: input.repurchaseLeadId ?? null,
          condition: vehicle.condition,
          price: salePrice,
          tradeInValue: input.tradeInValue ?? null,
          warrantyMonths,
          notes: input.notes,
          soldAt,
        },
        include: {
          vehicle: { select: { vin: true, model: true, modelYear: true } },
          customer: { select: { id: true, fullName: true, email: true } },
        },
      });

      await tx.notification.create({
        data: {
          userId: customer.id,
          type: NotificationType.SYSTEM,
          title: "Seu Ford está registrado no Vínculo 360",
          message: `${vehicle.model} ${vehicle.modelYear} vinculado à sua conta. A garantia vai até ${warrantyUntil.toLocaleDateString("pt-BR")}.`,
          link: "/veiculos",
        },
      });
      await tx.auditLog.create({
        data: {
          performedById: actor.userId,
          action: "SALE_REGISTER",
          entityType: "Sale",
          entityId: sale.id,
          metadata: {
            vin,
            price: salePrice,
            customerId: customer.id,
            tradeInVin: tradeIn?.vin ?? null,
          },
        },
      });
      return sale;
    });
    if (activation) {
      const pending = activation as {
        userId: string;
        email: string;
        fullName: string;
        token: string;
        expiresAt: Date;
      };
      const delivery = await this.messaging.sendSensitive(
        MessageChannel.EMAIL,
        "CUSTOMER_ACTIVATION",
        pending.email,
        {
          fullName: pending.fullName,
          vehicleLabel: `${vehicle.model} ${vehicle.modelYear}`,
          link: `${this.customerAppUrl()}/?reset=${pending.token}`,
          expiresAt: pending.expiresAt.toISOString(),
        },
        { userId: pending.userId },
      );
      if (delivery.status !== MessageStatus.SENT) {
        await this.prisma.passwordResetToken.updateMany({
          where: {
            tokenHash: createHash("sha256").update(pending.token).digest("hex"),
            usedAt: null,
          },
          data: { usedAt: new Date() },
        });
      }
      return { ...sale, activationEmailSent: delivery.status === MessageStatus.SENT };
    }
    return sale;
  }
}
