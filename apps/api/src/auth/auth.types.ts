import { UserRole } from '@prisma/client';

export type AuthenticatedUser = {
  userId: string;
  email: string;
  role: UserRole;
  dealershipId: string | null;
  sessionVersion: number;
  sessionId: string;
};
