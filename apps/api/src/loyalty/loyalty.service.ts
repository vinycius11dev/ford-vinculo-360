import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { UserRole, VoucherStatus } from '@prisma/client';
import { randomUUID } from 'crypto';
import { AuthenticatedUser } from '../auth/auth.types';
import { PrismaService } from '../prisma/prisma.service';
import { CreateVoucherDto } from './dto/create-voucher.dto';
import { customerScope } from '../common/access-scope';

@Injectable()
export class LoyaltyService {
  constructor(private readonly prisma: PrismaService) {}
  async account(userId: string, actor: AuthenticatedUser) {
    if (actor.role === UserRole.CUSTOMER && actor.userId !== userId) throw new ForbiddenException('Conta de fidelidade fora do seu acesso.');
    const account = await this.prisma.loyaltyAccount.findFirst({ where: { userId, user: customerScope(actor) }, include: { user: { select: { id: true, fullName: true, email: true } }, transactions: { orderBy: { createdAt: 'desc' }, take: 50 }, vouchers: { orderBy: { expiresAt: 'asc' } } } });
    if (!account) throw new NotFoundException('Conta de fidelidade não encontrada.');
    return account;
  }
  me(actor: AuthenticatedUser) { return this.account(actor.userId, actor); }
  async summary(actor: AuthenticatedUser) {
    const accountScope = { user: customerScope(actor) };
    const transactionScope = { loyaltyAccount: accountScope };
    const [balances, generated, redeemed, availableVouchers, voucherGroups] = await Promise.all([
      this.prisma.loyaltyAccount.aggregate({ where: accountScope, _sum: { balance: true }, _count: true }),
      this.prisma.pointTransaction.aggregate({ where: { ...transactionScope, amount: { gt: 0 } }, _sum: { amount: true } }),
      this.prisma.pointTransaction.aggregate({ where: { ...transactionScope, amount: { lt: 0 } }, _sum: { amount: true } }),
      this.prisma.voucher.count({ where: { ...transactionScope, status: 'AVAILABLE', OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }] } }),
      this.prisma.voucher.groupBy({ where: { ...transactionScope, status: 'REDEEMED' }, by: ['title'], _count: { title: true }, _sum: { pointsCost: true }, orderBy: { _count: { title: 'desc' } }, take: 6 }),
    ]);
    return { accounts: balances._count, balance: balances._sum.balance ?? 0, generated: generated._sum.amount ?? 0, redeemed: Math.abs(redeemed._sum.amount ?? 0), availableVouchers, benefits: voucherGroups.map(item => ({ title: item.title, redemptions: item._count.title, points: item._sum.pointsCost ?? 0 })) };
  }
  async createVoucher(input: CreateVoucherDto, actor: AuthenticatedUser) {
    const target = await this.prisma.user.findFirst({ where: { id: input.userId, ...customerScope(actor) } });
    if (!target || target.role !== UserRole.CUSTOMER) throw new NotFoundException('Cliente não encontrado.');
    const account = await this.prisma.loyaltyAccount.upsert({ where: { userId: input.userId }, update: {}, create: { userId: input.userId } });
    if (account.balance < input.pointsCost) throw new BadRequestException('Saldo insuficiente para emitir o benefício.');
    return this.prisma.$transaction(async tx => {
      const debit = await tx.loyaltyAccount.updateMany({ where: { id: account.id, balance: { gte: input.pointsCost } }, data: { balance: { decrement: input.pointsCost } } });
      if (debit.count !== 1) throw new BadRequestException('Saldo insuficiente para emitir o benefício.');
      const voucher = await tx.voucher.create({ data: { loyaltyAccountId: account.id, code: `FORD-${randomUUID().slice(0, 8).toUpperCase()}`, title: input.title, pointsCost: input.pointsCost, expiresAt: input.expiresAt ? new Date(input.expiresAt) : undefined } });
      await tx.pointTransaction.create({ data: { loyaltyAccountId: account.id, amount: -input.pointsCost, reason: `Emissão: ${input.title}` } });
      await tx.auditLog.create({ data: { performedById: actor.userId, action: 'VOUCHER_CREATE', entityType: 'Voucher', entityId: voucher.id } });
      return voucher;
    });
  }
  async redeem(code: string, actor: AuthenticatedUser) {
    const voucher = await this.prisma.voucher.findFirst({ where: { code, loyaltyAccount: { user: customerScope(actor) } }, include: { loyaltyAccount: true } });
    if (!voucher) throw new NotFoundException('Voucher não encontrado.');
    if (actor.role === UserRole.CUSTOMER && voucher.loyaltyAccount.userId !== actor.userId) throw new ForbiddenException('Voucher fora do seu acesso.');
    if (voucher.status !== VoucherStatus.AVAILABLE) throw new BadRequestException('Voucher indisponível.');
    if (voucher.expiresAt && voucher.expiresAt < new Date()) throw new BadRequestException('Voucher expirado.');
    return this.prisma.$transaction(async tx => {
      const changed = await tx.voucher.updateMany({ where: { id: voucher.id, status: VoucherStatus.AVAILABLE, OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }] }, data: { status: VoucherStatus.REDEEMED, redeemedAt: new Date() } });
      if (changed.count !== 1) throw new BadRequestException('Este voucher já foi utilizado ou expirou.');
      await tx.auditLog.create({ data: { performedById: actor.userId, action: 'VOUCHER_REDEEM', entityType: 'Voucher', entityId: voucher.id } });
      return tx.voucher.findUnique({ where: { id: voucher.id } });
    });
  }
}
