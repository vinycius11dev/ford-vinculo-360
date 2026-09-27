-- DropIndex
DROP INDEX `Booking_userId_fkey` ON `booking`;

-- DropIndex
DROP INDEX `Booking_vehicleId_fkey` ON `booking`;

-- DropIndex
DROP INDEX `CampaignTarget_vehicleId_fkey` ON `campaigntarget`;

-- DropIndex
DROP INDEX `DataSubjectRequest_handledById_fkey` ON `datasubjectrequest`;

-- DropIndex
DROP INDEX `PointTransaction_serviceOrderId_fkey` ON `pointtransaction`;

-- DropIndex
DROP INDEX `RepurchaseLead_createdById_fkey` ON `repurchaselead`;

-- DropIndex
DROP INDEX `RepurchaseLeadEvent_performedById_fkey` ON `repurchaseleadevent`;

-- DropIndex
DROP INDEX `ServiceOrder_dealershipId_fkey` ON `serviceorder`;

-- DropIndex
DROP INDEX `SupportTicket_assignedToId_fkey` ON `supportticket`;

-- DropIndex
DROP INDEX `UserInvitation_createdById_fkey` ON `userinvitation`;

-- DropIndex
DROP INDEX `Vehicle_originDealershipId_fkey` ON `vehicle`;

-- DropIndex
DROP INDEX `Voucher_loyaltyAccountId_fkey` ON `voucher`;

-- CreateTable
CREATE TABLE `OutboundMessage` (
    `id` VARCHAR(36) NOT NULL,
    `channel` ENUM('EMAIL', 'SMS', 'PUSH') NOT NULL,
    `templateKey` ENUM('TEAM_INVITATION', 'PASSWORD_RESET') NOT NULL,
    `recipient` VARCHAR(255) NOT NULL,
    `payload` JSON NOT NULL,
    `status` ENUM('PENDING', 'SENDING', 'SENT', 'FAILED', 'CANCELLED') NOT NULL DEFAULT 'PENDING',
    `attempts` INTEGER NOT NULL DEFAULT 0,
    `maxAttempts` INTEGER NOT NULL DEFAULT 5,
    `nextAttemptAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `lastError` TEXT NULL,
    `providerRef` VARCHAR(190) NULL,
    `userId` VARCHAR(36) NULL,
    `sentAt` DATETIME(3) NULL,
    `failedAt` DATETIME(3) NULL,
    `cancelledAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `OutboundMessage_status_nextAttemptAt_idx`(`status`, `nextAttemptAt`),
    INDEX `OutboundMessage_userId_createdAt_idx`(`userId`, `createdAt`),
    INDEX `OutboundMessage_templateKey_idx`(`templateKey`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `MessageEvent` (
    `id` VARCHAR(36) NOT NULL,
    `messageId` VARCHAR(36) NOT NULL,
    `status` ENUM('PENDING', 'SENDING', 'SENT', 'FAILED', 'CANCELLED') NOT NULL,
    `detail` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `MessageEvent_messageId_createdAt_idx`(`messageId`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `User` ADD CONSTRAINT `User_dealershipId_fkey` FOREIGN KEY (`dealershipId`) REFERENCES `Dealership`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Vehicle` ADD CONSTRAINT `Vehicle_originDealershipId_fkey` FOREIGN KEY (`originDealershipId`) REFERENCES `Dealership`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `VehicleOwnership` ADD CONSTRAINT `VehicleOwnership_vehicleId_fkey` FOREIGN KEY (`vehicleId`) REFERENCES `Vehicle`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `VehicleOwnership` ADD CONSTRAINT `VehicleOwnership_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ServiceOrder` ADD CONSTRAINT `ServiceOrder_vehicleId_fkey` FOREIGN KEY (`vehicleId`) REFERENCES `Vehicle`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ServiceOrder` ADD CONSTRAINT `ServiceOrder_dealershipId_fkey` FOREIGN KEY (`dealershipId`) REFERENCES `Dealership`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `LoyaltyAccount` ADD CONSTRAINT `LoyaltyAccount_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PointTransaction` ADD CONSTRAINT `PointTransaction_loyaltyAccountId_fkey` FOREIGN KEY (`loyaltyAccountId`) REFERENCES `LoyaltyAccount`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PointTransaction` ADD CONSTRAINT `PointTransaction_serviceOrderId_fkey` FOREIGN KEY (`serviceOrderId`) REFERENCES `ServiceOrder`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Voucher` ADD CONSTRAINT `Voucher_loyaltyAccountId_fkey` FOREIGN KEY (`loyaltyAccountId`) REFERENCES `LoyaltyAccount`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Booking` ADD CONSTRAINT `Booking_vehicleId_fkey` FOREIGN KEY (`vehicleId`) REFERENCES `Vehicle`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Booking` ADD CONSTRAINT `Booking_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Booking` ADD CONSTRAINT `Booking_dealershipId_fkey` FOREIGN KEY (`dealershipId`) REFERENCES `Dealership`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CampaignTarget` ADD CONSTRAINT `CampaignTarget_campaignId_fkey` FOREIGN KEY (`campaignId`) REFERENCES `Campaign`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CampaignTarget` ADD CONSTRAINT `CampaignTarget_vehicleId_fkey` FOREIGN KEY (`vehicleId`) REFERENCES `Vehicle`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `RepurchaseLead` ADD CONSTRAINT `RepurchaseLead_vehicleId_fkey` FOREIGN KEY (`vehicleId`) REFERENCES `Vehicle`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `RepurchaseLead` ADD CONSTRAINT `RepurchaseLead_ownerId_fkey` FOREIGN KEY (`ownerId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `RepurchaseLead` ADD CONSTRAINT `RepurchaseLead_dealershipId_fkey` FOREIGN KEY (`dealershipId`) REFERENCES `Dealership`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `RepurchaseLead` ADD CONSTRAINT `RepurchaseLead_createdById_fkey` FOREIGN KEY (`createdById`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `RepurchaseLeadEvent` ADD CONSTRAINT `RepurchaseLeadEvent_leadId_fkey` FOREIGN KEY (`leadId`) REFERENCES `RepurchaseLead`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `RepurchaseLeadEvent` ADD CONSTRAINT `RepurchaseLeadEvent_performedById_fkey` FOREIGN KEY (`performedById`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `RecallTarget` ADD CONSTRAINT `RecallTarget_recallId_fkey` FOREIGN KEY (`recallId`) REFERENCES `Recall`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `RecallTarget` ADD CONSTRAINT `RecallTarget_vehicleId_fkey` FOREIGN KEY (`vehicleId`) REFERENCES `Vehicle`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Notification` ADD CONSTRAINT `Notification_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Notification` ADD CONSTRAINT `Notification_dealershipId_fkey` FOREIGN KEY (`dealershipId`) REFERENCES `Dealership`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `UserConsent` ADD CONSTRAINT `UserConsent_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `DataSubjectRequest` ADD CONSTRAINT `DataSubjectRequest_requestedById_fkey` FOREIGN KEY (`requestedById`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `DataSubjectRequest` ADD CONSTRAINT `DataSubjectRequest_handledById_fkey` FOREIGN KEY (`handledById`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PasswordResetToken` ADD CONSTRAINT `PasswordResetToken_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AuthSession` ADD CONSTRAINT `AuthSession_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `UserInvitation` ADD CONSTRAINT `UserInvitation_dealershipId_fkey` FOREIGN KEY (`dealershipId`) REFERENCES `Dealership`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `UserInvitation` ADD CONSTRAINT `UserInvitation_createdById_fkey` FOREIGN KEY (`createdById`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SupportTicket` ADD CONSTRAINT `SupportTicket_requesterId_fkey` FOREIGN KEY (`requesterId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SupportTicket` ADD CONSTRAINT `SupportTicket_dealershipId_fkey` FOREIGN KEY (`dealershipId`) REFERENCES `Dealership`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SupportTicket` ADD CONSTRAINT `SupportTicket_assignedToId_fkey` FOREIGN KEY (`assignedToId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `OutboundMessage` ADD CONSTRAINT `OutboundMessage_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `MessageEvent` ADD CONSTRAINT `MessageEvent_messageId_fkey` FOREIGN KEY (`messageId`) REFERENCES `OutboundMessage`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AuditLog` ADD CONSTRAINT `AuditLog_performedById_fkey` FOREIGN KEY (`performedById`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
