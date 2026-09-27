import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { MessageChannel, OwnershipStatus, UserRole, VehicleCondition } from '@prisma/client';
import { hash } from 'bcryptjs';
import { randomBytes } from 'node:crypto';
import { AuthenticatedUser } from '../auth/auth.types';
import { MessagingService } from '../messaging/messaging.service';
import { PrismaService } from '../prisma/prisma.service';
import { ClaimVehicleDto } from './dto/claim-vehicle.dto';
import { SelfRegisterVehicleDto } from './dto/self-register-vehicle.dto';
import { TransferVehicleDto } from './dto/transfer-vehicle.dto';

@Injectable()
export class OwnershipsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly messaging: MessagingService,
  ) {}

  private readonly claimDeniedMessage =
    'Não foi possível vincular o veículo. Confira o VIN e a placa ou procure uma concessionária Ford.';

  private async auditDeniedClaim(
    actor: AuthenticatedUser,
    vin: string,
    reason: 'VEHICLE_NOT_FOUND_OR_PLATE_MISMATCH' | 'ACTIVE_OWNER_EXISTS',
  ) {
    await this.prisma.auditLog.create({
      data: {
        performedById: actor.userId,
        action: 'VEHICLE_CLAIM_DENIED',
        entityType: 'VehicleOwnership',
        metadata: {
          // Suficiente para investigação sem replicar o identificador completo
          // do veículo em uma tentativa que pode ser inválida.
          vinSuffix: vin.slice(-6),
          reason,
        },
      },
    });
  }

  async list(actor: AuthenticatedUser) {
    const where = actor.role === UserRole.CUSTOMER
      ? { userId: actor.userId }
      : actor.role === UserRole.FORD_ADMIN
        ? {}
        : { vehicle: { OR: [{ originDealershipId: actor.dealershipId ?? '__none__' }, { serviceOrders: { some: { dealershipId: actor.dealershipId ?? '__none__' } } }] } };
    const ownerships = await this.prisma.vehicleOwnership.findMany({
      where,
      include: { vehicle: true, user: { select: { id: true, fullName: true, email: true, phone: true } } },
      orderBy: { startedAt: 'desc' },
      take: 250,
    });
    if (actor.role !== UserRole.CUSTOMER) return ownerships;

    const pendingTickets = await this.prisma.supportTicket.findMany({
      where: {
        requesterId: actor.userId,
        subject: { startsWith: 'Validação de veículo informado pelo cliente' },
      },
      select: { message: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    return ownerships.map((ownership) => {
      if (ownership.status !== OwnershipStatus.PENDING_VERIFICATION) return ownership;
      const ticket = pendingTickets.find(({ message }) =>
        message.includes(`VIN: ${ownership.vehicle.vin}`),
      );
      const mileageMatch = ticket?.message.match(/Quilometragem declarada:\s*([\d.]+)\s*km/i);
      const colorMatch = ticket?.message.match(/Cor declarada:\s*(.+)/i);
      return {
        ...ownership,
        declaredMileage: mileageMatch
          ? Number(mileageMatch[1].replace(/\./g, ''))
          : ownership.vehicle.currentMileage,
        declaredColor: colorMatch?.[1]?.trim() || ownership.vehicle.exteriorColor,
      };
    });
  }

  /** Dados mínimos para que alguém sem conta escolha a unidade que irá revisar o pedido. */
  publicDealerships() {
    return this.prisma.dealership.findMany({
      select: { id: true, tradeName: true, city: true, state: true },
      orderBy: { tradeName: 'asc' },
      take: 50,
    });
  }

  /**
   * Catálogo público e não sensível do autocadastro. Une o catálogo comercial
   * às combinações históricas já conhecidas, sem expor VIN, placa ou proprietário.
   */
  async publicVehicleOptions() {
    const [catalog, knownVehicles] = await Promise.all([
      this.prisma.catalogItem.findMany({
        where: { published: true, vehicleModel: { published: true } },
        select: {
          name: true,
          modelYear: true,
          exteriorColor: true,
          exteriorColors: true,
          imageUrl: true,
          vehicleModel: { select: { imageUrl: true } },
        },
        orderBy: [{ name: 'asc' }, { modelYear: 'desc' }],
      }),
      this.prisma.vehicle.findMany({
        select: {
          model: true,
          modelYear: true,
          manufactureYear: true,
          exteriorColor: true,
          imageUrl: true,
        },
        orderBy: [{ model: 'asc' }, { modelYear: 'desc' }],
        take: 1000,
      }),
    ]);
    type MutableOption = {
      key: string;
      name: string;
      modelYear: number;
      manufactureYears: Set<number>;
      colors: Set<string>;
      imageUrl: string | null;
    };
    const options = new Map<string, MutableOption>();
    const include = (
      name: string,
      modelYear: number,
      manufactureYear: number,
      color: string | null,
      imageUrl: string | null,
    ) => {
      const key = `${name.trim().toLocaleLowerCase('pt-BR')}::${modelYear}`;
      const option = options.get(key) ?? {
        key,
        name: name.trim(),
        modelYear,
        manufactureYears: new Set<number>(),
        colors: new Set<string>(),
        imageUrl,
      };
      option.manufactureYears.add(manufactureYear);
      if (color?.trim()) option.colors.add(color.trim());
      if (!option.imageUrl && imageUrl) option.imageUrl = imageUrl;
      options.set(key, option);
    };
    for (const item of catalog) {
      if (item.modelYear) {
        const configuredColors = Array.isArray(item.exteriorColors)
          ? item.exteriorColors.filter((color): color is string => typeof color === 'string')
          : [];
        const colors = [...new Set([item.exteriorColor, ...configuredColors].filter((color): color is string => Boolean(color?.trim())))];
        for (const color of colors)
        include(
          item.name,
          item.modelYear,
          item.modelYear,
          color,
          item.imageUrl ?? item.vehicleModel.imageUrl,
        );
      }
    }
    for (const item of knownVehicles)
      include(
        item.model,
        item.modelYear,
        item.manufactureYear,
        item.exteriorColor,
        item.imageUrl,
      );
    return [...options.values()]
      .filter((item) => item.colors.size > 0)
      .map((item) => ({
        ...item,
        manufactureYears: [...item.manufactureYears].sort((a, b) => b - a),
        colors: [...item.colors].sort((a, b) => a.localeCompare(b, 'pt-BR')),
      }))
      .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR') || b.modelYear - a.modelYear);
  }

  async selfRegistration(input: SelfRegisterVehicleDto) {
    if (!input.termsAccepted)
      throw new BadRequestException('Confirme que os dados do veículo são verdadeiros para continuar.');
    if (input.modelYear < input.manufactureYear)
      throw new BadRequestException('O ano-modelo não pode ser anterior ao ano de fabricação.');

    const email = input.email.toLowerCase();
    const vin = input.vin.toUpperCase();
    const plate = input.plate?.toUpperCase() || null;
    const model = input.model.trim();
    const exteriorColor = input.exteriorColor.trim();
    const [catalogModel, fleetModel, catalogConfiguration, fleetConfiguration] =
      await Promise.all([
        this.prisma.catalogItem.findFirst({
          where: { published: true, name: model, modelYear: input.modelYear },
          select: { id: true },
        }),
        this.prisma.vehicle.findFirst({
          where: { model, modelYear: input.modelYear },
          select: { id: true },
        }),
        this.prisma.catalogItem.findFirst({
          where: {
            published: true,
            name: model,
            modelYear: input.modelYear,
            exteriorColor,
          },
          select: { id: true, version: true, imageUrl: true },
        }),
        this.prisma.vehicle.findFirst({
          where: { model, modelYear: input.modelYear, exteriorColor },
          select: { version: true, imageUrl: true, catalogItemId: true },
        }),
      ]);
    if (!catalogModel && !fleetModel)
      throw new BadRequestException('Selecione um modelo reconhecido no catálogo da Rede Ford.');
    if (!catalogConfiguration && !fleetConfiguration)
      throw new BadRequestException('Selecione uma cor disponível para este modelo e ano.');
    const requestedDealership = input.preferredDealershipId
      ? await this.prisma.dealership.findUnique({
          where: { id: input.preferredDealershipId },
          select: { id: true, tradeName: true },
        })
      : null;
    if (input.preferredDealershipId && !requestedDealership)
      throw new BadRequestException('A concessionária selecionada não foi encontrada.');

    const existingUser = await this.prisma.user.findUnique({
      where: { email },
      select: { id: true, role: true, active: true, passwordSetupRequired: true },
    });
    // Contas internas nunca são reutilizadas pela experiência do cliente.
    if (existingUser && existingUser.role !== UserRole.CUSTOMER)
      return this.pendingResponse();
    // Para contas já ativadas, exigimos sessão autenticada no fluxo de garagem.
    // Assim, ninguém consegue abrir solicitações em nome de um e-mail existente.
    if (existingUser?.active && !existingUser.passwordSetupRequired)
      return {
        message: 'Se você já possui acesso, entre no Ford App e use “Vincular meu Ford” na garagem. Se esqueceu a senha, use “Primeiro acesso”.',
        requiresLogin: true,
      };

    const created = await this.prisma.$transaction(async (tx) => {
      let customerId = existingUser?.id;
      if (!customerId) {
        const customer = await tx.user.create({
          data: {
            email,
            fullName: input.fullName,
            phone: input.phone ?? null,
            role: UserRole.CUSTOMER,
            registeredByDealershipId: requestedDealership?.id ?? null,
            passwordHash: await hash(randomBytes(24).toString('hex'), 12),
            active: false,
            passwordSetupRequired: true,
            loyalty: { create: {} },
          },
          select: { id: true, email: true, fullName: true },
        });
        customerId = customer.id;
      } else {
        await tx.user.update({
          where: { id: customerId },
          data: {
            fullName: input.fullName,
            phone: input.phone ?? null,
            registeredByDealershipId: requestedDealership?.id ?? undefined,
          },
        });
      }

      let vehicle = await tx.vehicle.findUnique({ where: { vin } });
      if (!vehicle) {
        vehicle = await tx.vehicle.create({
          data: {
            vin,
            plate,
            model,
            version: catalogConfiguration?.version ?? fleetConfiguration?.version ?? null,
            manufactureYear: input.manufactureYear,
            modelYear: input.modelYear,
            currentMileage: input.currentMileage,
            exteriorColor,
            imageUrl: catalogConfiguration?.imageUrl ?? fleetConfiguration?.imageUrl ?? null,
            catalogItemId: catalogConfiguration?.id ?? fleetConfiguration?.catalogItemId ?? null,
            condition: VehicleCondition.USED,
            originDealershipId: requestedDealership?.id ?? null,
            sourceSystem: 'CUSTOMER_SELF_REGISTRATION',
          },
        });
      }

      const dealershipId = requestedDealership?.id ?? vehicle.originDealershipId ?? null;
      const existingRequest = await tx.vehicleOwnership.findFirst({
        where: { vehicleId: vehicle.id, userId: customerId, status: OwnershipStatus.PENDING_VERIFICATION },
        select: { id: true },
      });
      const ownership = existingRequest ?? await tx.vehicleOwnership.create({
        data: { vehicleId: vehicle.id, userId: customerId, status: OwnershipStatus.PENDING_VERIFICATION },
        select: { id: true },
      });

      if (!existingRequest) {
        const ticket = await tx.supportTicket.create({
          data: {
            requesterId: customerId,
            dealershipId,
            category: 'OTHER',
            priority: 'HIGH',
            subject: `Validação de veículo informado pelo cliente · ${model}`,
            message: [
              'Cadastro iniciado pelo Ford App.',
              `VIN: ${vin}`,
              `Placa informada: ${plate ?? 'não informada'}`,
              `Veículo informado: ${model} ${input.manufactureYear}/${input.modelYear}`,
              `Cor declarada: ${exteriorColor}`,
              `Quilometragem declarada: ${input.currentMileage.toLocaleString('pt-BR')} km`,
              'Ação necessária: conferir documento/posse e aprovar ou recusar o vínculo antes de qualquer atendimento comercial.',
            ].join('\n'),
          },
        });
        const recipients = await tx.user.findMany({
          where: {
            active: true,
            OR: [
              { role: UserRole.FORD_ADMIN },
              ...(dealershipId ? [{ dealershipId, role: { in: [UserRole.DEALERSHIP_MANAGER, UserRole.DEALERSHIP_AGENT] } }] : []),
            ],
          },
          select: { id: true },
        });
        if (recipients.length) {
          await tx.notification.createMany({
            data: recipients.map(({ id }) => ({
              userId: id,
              type: 'SYSTEM',
              title: 'Novo veículo para validação',
              message: `${input.fullName} informou um ${model} ${exteriorColor} e aguarda conferência do vínculo.`,
              link: `/validacoes?ticket=${ticket.id}`,
            })),
          });
        }
        await tx.auditLog.create({
          data: {
            performedById: customerId,
            action: 'CUSTOMER_SELF_VEHICLE_REGISTRATION',
            entityType: 'VehicleOwnership',
            entityId: ownership.id,
            metadata: { vinSuffix: vin.slice(-6), dealershipId, supportTicketId: ticket.id },
          },
        });
      }

      return { customerId, isNewRequest: !existingRequest, dealershipId };
    });
    // Só confirma por e-mail pedidos novos, para reenvios não gerarem spam.
    if (created.isNewRequest) {
      const dealershipName = requestedDealership?.tradeName ?? (created.dealershipId
        ? (await this.prisma.dealership.findUnique({ where: { id: created.dealershipId }, select: { tradeName: true } }))?.tradeName
        : null);
      await this.messaging.enqueue(
        MessageChannel.EMAIL,
        'VEHICLE_REGISTRATION_RECEIVED',
        email,
        {
          fullName: input.fullName,
          vehicleLabel: `${model} ${input.modelYear} · ${exteriorColor} · VIN final ${vin.slice(-6)}`,
          dealershipName: dealershipName ?? null,
        },
        { userId: created.customerId },
      );
    }
    return this.pendingResponse();
  }

  private pendingResponse() {
    return {
      message: 'Cadastro recebido! Sua conta ficará em análise até a Rede Ford conferir os dados do veículo. Enviamos um e-mail de confirmação e, após a aprovação, você receberá o link para criar sua senha e acessar o Ford App.',
      status: OwnershipStatus.PENDING_VERIFICATION,
    };
  }

  async claim(input: ClaimVehicleDto, actor: AuthenticatedUser) {
    if (actor.role !== UserRole.CUSTOMER)
      throw new ForbiddenException(
        'Somente clientes podem reivindicar um veículo.',
      );

    const vehicle = await this.prisma.vehicle.findUnique({
      where: { vin: input.vin },
      select: {
        id: true,
        vin: true,
        plate: true,
        model: true,
        modelYear: true,
        currentMileage: true,
      },
    });
    if (!vehicle || vehicle.plate?.toUpperCase() !== input.plate) {
      await this.auditDeniedClaim(
        actor,
        input.vin,
        'VEHICLE_NOT_FOUND_OR_PLATE_MISMATCH',
      );
      throw new BadRequestException(this.claimDeniedMessage);
    }

    try {
      return await this.prisma.$transaction(async (tx) => {
        // O bloqueio do registro do veículo serializa duas tentativas simultâneas
        // e impede a criação de mais de um vínculo ACTIVE para o mesmo VIN.
        await tx.$queryRaw`
          SELECT id FROM Vehicle WHERE id = ${vehicle.id} FOR UPDATE
        `;

        const active = await tx.vehicleOwnership.findFirst({
          where: {
            vehicleId: vehicle.id,
            status: OwnershipStatus.ACTIVE,
          },
          select: {
            id: true,
            vehicleId: true,
            userId: true,
            status: true,
            startedAt: true,
            createdAt: true,
          },
        });

        if (active?.userId === actor.userId) {
          await tx.auditLog.create({
            data: {
              performedById: actor.userId,
              action: 'VEHICLE_CLAIM_ALREADY_ACTIVE',
              entityType: 'VehicleOwnership',
              entityId: active.id,
              metadata: { vehicleId: vehicle.id },
            },
          });
          return {
            ...active,
            alreadyLinked: true,
            message: 'Este veículo já está vinculado à sua conta.',
            vehicle,
          };
        }
        if (active) throw new Error('ACTIVE_OWNER_EXISTS');

        const ownership = await tx.vehicleOwnership.create({
          data: {
            vehicleId: vehicle.id,
            userId: actor.userId,
            status: OwnershipStatus.ACTIVE,
          },
          select: {
            id: true,
            vehicleId: true,
            userId: true,
            status: true,
            startedAt: true,
            createdAt: true,
          },
        });
        await tx.loyaltyAccount.upsert({
          where: { userId: actor.userId },
          update: {},
          create: { userId: actor.userId },
        });
        await tx.auditLog.create({
          data: {
            performedById: actor.userId,
            action: 'VEHICLE_CLAIM',
            entityType: 'VehicleOwnership',
            entityId: ownership.id,
            metadata: { vehicleId: vehicle.id, vin: vehicle.vin },
          },
        });
        return {
          ...ownership,
          alreadyLinked: false,
          message: 'Veículo vinculado com sucesso.',
          vehicle,
        };
      });
    } catch (error) {
      if (error instanceof Error && error.message === 'ACTIVE_OWNER_EXISTS') {
        await this.auditDeniedClaim(actor, input.vin, 'ACTIVE_OWNER_EXISTS');
        throw new BadRequestException(this.claimDeniedMessage);
      }
      throw error;
    }
  }

  async transfer(input: TransferVehicleDto, actor: AuthenticatedUser) {
    const vehicle = await this.prisma.vehicle.findUnique({ where: { vin: input.vin.toUpperCase() } });
    if (!vehicle) throw new NotFoundException('Veículo não encontrado.');
    if (actor.role !== UserRole.FORD_ADMIN && vehicle.originDealershipId !== actor.dealershipId) throw new ForbiddenException('Veículo fora da sua concessionária.');
    const newOwner = await this.prisma.user.findUnique({ where: { email: input.newOwnerEmail.toLowerCase() } });
    if (!newOwner || newOwner.role !== UserRole.CUSTOMER) throw new NotFoundException('Cliente destinatário não encontrado.');

    return this.prisma.$transaction(async tx => {
      await tx.vehicleOwnership.updateMany({ where: { vehicleId: vehicle.id, status: OwnershipStatus.ACTIVE }, data: { status: OwnershipStatus.ENDED, endedAt: new Date() } });
      const ownership = await tx.vehicleOwnership.create({ data: { vehicleId: vehicle.id, userId: newOwner.id, status: OwnershipStatus.ACTIVE } });
      await tx.loyaltyAccount.upsert({ where: { userId: newOwner.id }, update: {}, create: { userId: newOwner.id } });
      await tx.auditLog.create({ data: { performedById: actor.userId, action: 'VEHICLE_TRANSFER', entityType: 'VehicleOwnership', entityId: ownership.id, metadata: { vin: vehicle.vin, newOwnerId: newOwner.id } } });
      return ownership;
    });
  }
}
