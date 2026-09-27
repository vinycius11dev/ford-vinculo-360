import { PrismaClient, UserRole } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  if (process.env.NODE_ENV === "production") {
    throw new Error("Reset blocked: operational data cannot be reset in production.");
  }
  if (process.env.CONFIRM_OPERATIONAL_DATA_RESET !== "YES") {
    throw new Error(
      "Reset blocked. Set CONFIRM_OPERATIONAL_DATA_RESET=YES to confirm the local data deletion.",
    );
  }

  const removed = await prisma.$transaction(
    async (tx) => {
      const counts: Record<string, number> = {};

      counts.messageEvents = (await tx.messageEvent.deleteMany()).count;
      counts.outboundMessages = (await tx.outboundMessage.deleteMany()).count;
      counts.repurchaseLeadEvents = (await tx.repurchaseLeadEvent.deleteMany()).count;
      counts.sales = (await tx.sale.deleteMany()).count;
      counts.repurchaseLeads = (await tx.repurchaseLead.deleteMany()).count;
      counts.campaignTargets = (await tx.campaignTarget.deleteMany()).count;
      counts.campaigns = (await tx.campaign.deleteMany()).count;
      counts.recallTargets = (await tx.recallTarget.deleteMany()).count;
      counts.recalls = (await tx.recall.deleteMany()).count;
      counts.pointTransactions = (await tx.pointTransaction.deleteMany()).count;
      counts.vouchers = (await tx.voucher.deleteMany()).count;
      counts.loyaltyAccounts = (await tx.loyaltyAccount.deleteMany()).count;
      counts.bookings = (await tx.booking.deleteMany()).count;
      counts.serviceOrders = (await tx.serviceOrder.deleteMany()).count;
      counts.vehicleOwnerships = (await tx.vehicleOwnership.deleteMany()).count;
      counts.notifications = (await tx.notification.deleteMany()).count;
      counts.userConsents = (await tx.userConsent.deleteMany()).count;
      counts.dataSubjectRequests = (await tx.dataSubjectRequest.deleteMany()).count;
      counts.passwordResetTokens = (await tx.passwordResetToken.deleteMany()).count;
      // Mantém apenas as sessões dos acessos internos reais para não derrubar
      // quem está administrando a limpeza. Sessões de clientes e de smoke test
      // são removidas antes dos respectivos usuários.
      counts.authSessions = (
        await tx.authSession.deleteMany({
          where: {
            OR: [
              { user: { role: UserRole.CUSTOMER } },
              { user: { email: { contains: "smoke." } } },
            ],
          },
        })
      ).count;
      counts.userInvitations = (await tx.userInvitation.deleteMany()).count;
      counts.supportTickets = (await tx.supportTicket.deleteMany()).count;
      counts.auditLogs = (await tx.auditLog.deleteMany()).count;
      counts.vehicles = (await tx.vehicle.deleteMany()).count;
      counts.catalogItems = (await tx.catalogItem.deleteMany()).count;
      counts.vehicleModels = (await tx.vehicleModel.deleteMany()).count;
      counts.customers = (
        await tx.user.deleteMany({ where: { role: UserRole.CUSTOMER } })
      ).count;
      counts.testUsers = (
        await tx.user.deleteMany({ where: { email: { contains: "smoke." } } })
      ).count;

      return counts;
    },
    { maxWait: 10_000, timeout: 120_000 },
  );

  const preserved = {
    internalUsers: await prisma.user.count({
      where: { role: { not: UserRole.CUSTOMER } },
    }),
    dealerships: await prisma.dealership.count(),
    vehicleModels: await prisma.vehicleModel.count(),
    catalogItems: await prisma.catalogItem.count(),
    programSettings: await prisma.programSettings.count(),
  };

  console.log(JSON.stringify({ removed, preserved }, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
