import { Injectable } from "@nestjs/common";
import { Prisma, UserRole } from "@prisma/client";
import { AuthenticatedUser } from "../auth/auth.types";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  list(actor: AuthenticatedUser) {
    const where: Prisma.AuditLogWhereInput =
      actor.role === UserRole.FORD_ADMIN
        ? {}
        : { performedBy: { dealershipId: actor.dealershipId ?? "__none__" } };
    return this.prisma.auditLog.findMany({
      where,
      include: {
        performedBy: {
          select: { id: true, fullName: true, email: true, role: true },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 100,
    });
  }
}
