import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { NotificationType, Prisma, ServiceOrderStatus, UserRole } from '@prisma/client';
import { AuthenticatedUser } from '../auth/auth.types';
import { PrismaService } from '../prisma/prisma.service';
import { CreateServiceOrderDto } from './dto/create-service-order.dto';
import { UpdateServiceOrderDto } from './dto/update-service-order.dto';

@Injectable()
export class ServiceOrdersService {
  constructor(private readonly prisma: PrismaService) {}

  list(actor: AuthenticatedUser) {
    const where: Prisma.ServiceOrderWhereInput = actor.role === UserRole.CUSTOMER
      ? { vehicle: { ownerships: { some: { userId: actor.userId, status: 'ACTIVE' } } } }
      : actor.role === UserRole.FORD_ADMIN ? {} : { dealershipId: actor.dealershipId ?? '__none__' };
    return this.prisma.serviceOrder.findMany({
      where,
      include: { dealership: { select: { id: true, tradeName: true } }, vehicle: { include: { ownerships: { where: { status: 'ACTIVE' }, select: { user: { select: { id: true, fullName: true, phone: true } } } } } } },
      orderBy: { createdAt: 'desc' }, take: 250,
    });
  }

  async create(input: CreateServiceOrderDto, actor: AuthenticatedUser) {
    const vehicle = await this.prisma.vehicle.findUnique({ where: { vin: input.vin.toUpperCase() } });
    if (!vehicle) throw new NotFoundException('Veículo não encontrado.');
    const dealershipId = actor.role === UserRole.FORD_ADMIN ? input.dealershipId : actor.dealershipId;
    if (!dealershipId) throw new BadRequestException('Informe uma concessionária.');
    const order = await this.prisma.serviceOrder.create({ data: { vehicleId: vehicle.id, dealershipId, mileage: input.mileage, description: input.description, amount: input.amount } });
    await this.prisma.auditLog.create({ data: { performedById: actor.userId, action: 'SERVICE_ORDER_CREATE', entityType: 'ServiceOrder', entityId: order.id, metadata: { vin: vehicle.vin } } });
    return order;
  }

  async update(id: string, input: UpdateServiceOrderDto, actor: AuthenticatedUser) {
    const order = await this.prisma.serviceOrder.findUnique({ where: { id }, include: { vehicle: { include: { ownerships: { where: { status: 'ACTIVE' }, take: 1 } } } } });
    if (!order) throw new NotFoundException('Ordem de serviço não encontrada.');
    if (actor.role !== UserRole.FORD_ADMIN && order.dealershipId !== actor.dealershipId) throw new ForbiddenException('Ordem fora da sua concessionária.');
    if ([ServiceOrderStatus.COMPLETED, ServiceOrderStatus.CANCELLED].includes(order.status as 'COMPLETED' | 'CANCELLED') && input.status && input.status !== order.status)
      throw new BadRequestException('Uma ordem encerrada não pode ser reaberta. Abra um novo atendimento.');
    return this.prisma.$transaction(async tx => {
      const completed = input.status === ServiceOrderStatus.COMPLETED;
      const newlyCompleted = completed && order.status !== ServiceOrderStatus.COMPLETED;
      const change = await tx.serviceOrder.updateMany({ where: { id, updatedAt: order.updatedAt, status: order.status }, data: { status: input.status, mileage: input.mileage, description: input.description, amount: input.amount, completedAt: newlyCompleted ? new Date() : undefined } });
      if (change.count !== 1) throw new ConflictException('Esta ordem foi atualizada em outro acesso. Atualize a tela e tente novamente.');
      const updated = await tx.serviceOrder.findUniqueOrThrow({ where: { id } });
      if (input.mileage && input.mileage > order.vehicle.currentMileage) await tx.vehicle.update({ where: { id: order.vehicleId }, data: { currentMileage: input.mileage } });
      if (newlyCompleted) {
        await tx.campaignTarget.updateMany({
          where: { vehicleId: order.vehicleId, sentAt: { not: null }, convertedAt: null },
          data: { convertedAt: new Date() },
        });
        const owner = order.vehicle.ownerships[0];
        if (owner) {
          const account = await tx.loyaltyAccount.upsert({ where: { userId: owner.userId }, update: {}, create: { userId: owner.userId } });
          const policy = await tx.programSettings.findUnique({ where: { id: 'default' } });
          const points = input.points ?? Math.max(policy?.minimumPoints ?? 100, Math.round(updated.mileage / (policy?.mileagePerPoint ?? 100)));
          const exists = await tx.pointTransaction.findFirst({ where: { serviceOrderId: id } });
          if (!exists) {
            await tx.pointTransaction.create({ data: { loyaltyAccountId: account.id, serviceOrderId: id, amount: points, reason: updated.description || 'Serviço concluído' } });
            await tx.loyaltyAccount.update({ where: { id: account.id }, data: { balance: { increment: points } } });
          }
          // O cliente precisa saber que o serviço fechou e quanto pontuou —
          // sem isso a conclusão da OS é invisível para ele.
          await tx.notification.create({
            data: {
              userId: owner.userId,
              type: NotificationType.SERVICE,
              title: 'Serviço concluído',
              message: `${updated.description || 'Seu atendimento'} foi finalizado com ${updated.mileage.toLocaleString('pt-BR')} km no odômetro.${exists ? '' : ` Você ganhou ${points.toLocaleString('pt-BR')} pontos.`}`,
              link: `/veiculos/${order.vehicle.vin}`,
            },
          });
        }
      }
      await tx.auditLog.create({ data: { performedById: actor.userId, action: completed ? 'SERVICE_ORDER_COMPLETE' : 'SERVICE_ORDER_UPDATE', entityType: 'ServiceOrder', entityId: id, metadata: { status: input.status, mileage: input.mileage } } });
      return updated;
    });
  }
}
