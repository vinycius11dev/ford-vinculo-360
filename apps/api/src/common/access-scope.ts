import { Prisma, UserRole } from '@prisma/client';
import { AuthenticatedUser } from '../auth/auth.types';

export function vehicleScope(actor: AuthenticatedUser): Prisma.VehicleWhereInput {
  if (actor.role === UserRole.FORD_ADMIN) return {};
  if (actor.role === UserRole.CUSTOMER) return { ownerships: { some: { userId: actor.userId, status: 'ACTIVE' } } };
  if (!actor.dealershipId) return { id: '__no_access__' };
  return { OR: [
    { originDealershipId: actor.dealershipId },
    { serviceOrders: { some: { dealershipId: actor.dealershipId } } },
  ] };
}

export function customerScope(actor: AuthenticatedUser): Prisma.UserWhereInput {
  if (actor.role === UserRole.FORD_ADMIN) return {};
  if (actor.role === UserRole.CUSTOMER) return { id: actor.userId };
  if (!actor.dealershipId) return { id: '__no_access__' };
  return { role: UserRole.CUSTOMER, OR: [
    { registeredByDealershipId: actor.dealershipId },
    { ownerships: { some: { status: 'ACTIVE', vehicle: vehicleScope(actor) } } },
  ] };
}
