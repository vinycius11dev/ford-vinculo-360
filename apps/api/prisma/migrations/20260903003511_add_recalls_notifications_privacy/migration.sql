-- DropIndex
DROP INDEX `Booking_userId_fkey` ON `booking`;

-- DropIndex
DROP INDEX `Booking_vehicleId_fkey` ON `booking`;

-- DropIndex
DROP INDEX `CampaignTarget_vehicleId_fkey` ON `campaigntarget`;

-- DropIndex
DROP INDEX `PointTransaction_serviceOrderId_fkey` ON `pointtransaction`;

-- DropIndex
DROP INDEX `RepurchaseLead_createdById_fkey` ON `repurchaselead`;

-- DropIndex
DROP INDEX `RepurchaseLeadEvent_performedById_fkey` ON `repurchaseleadevent`;

-- DropIndex
DROP INDEX `ServiceOrder_dealershipId_fkey` ON `serviceorder`;

-- DropIndex
DROP INDEX `Vehicle_originDealershipId_fkey` ON `vehicle`;

-- DropIndex
DROP INDEX `Voucher_loyaltyAccountId_fkey` ON `voucher`;

-- CreateTable
CREATE TABLE `Recall` (
    `id` VARCHAR(36) NOT NULL,
    `code` VARCHAR(40) NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `description` TEXT NOT NULL,
    `severity` ENUM('LOW', 'MEDIUM', 'HIGH', 'CRITICAL') NOT NULL DEFAULT 'HIGH',
    `active` BOOLEAN NOT NULL DEFAULT true,
    `startsAt` DATETIME(3) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Recall_code_key`(`code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `RecallTarget` (
    `id` VARCHAR(36) NOT NULL,
    `recallId` VARCHAR(36) NOT NULL,
    `vehicleId` VARCHAR(36) NOT NULL,
    `status` ENUM('PENDING', 'CONTACTED', 'SCHEDULED', 'COMPLETED') NOT NULL DEFAULT 'PENDING',
    `notifiedAt` DATETIME(3) NULL,
    `completedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `RecallTarget_vehicleId_status_idx`(`vehicleId`, `status`),
    UNIQUE INDEX `RecallTarget_recallId_vehicleId_key`(`recallId`, `vehicleId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Notification` (
    `id` VARCHAR(36) NOT NULL,
    `userId` VARCHAR(36) NULL,
    `dealershipId` VARCHAR(36) NULL,
    `type` ENUM('SERVICE', 'CAMPAIGN', 'RECALL', 'LOYALTY', 'SYSTEM') NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `message` TEXT NOT NULL,
    `link` VARCHAR(255) NULL,
    `readAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `Notification_userId_readAt_createdAt_idx`(`userId`, `readAt`, `createdAt`),
    INDEX `Notification_dealershipId_createdAt_idx`(`dealershipId`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `UserConsent` (
    `id` VARCHAR(36) NOT NULL,
    `userId` VARCHAR(36) NOT NULL,
    `purpose` ENUM('MARKETING', 'ANALYTICS', 'PERSONALIZATION') NOT NULL,
    `granted` BOOLEAN NOT NULL DEFAULT false,
    `source` VARCHAR(30) NOT NULL DEFAULT 'WEB',
    `grantedAt` DATETIME(3) NULL,
    `revokedAt` DATETIME(3) NULL,
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `UserConsent_userId_purpose_key`(`userId`, `purpose`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `DataSubjectRequest` (
    `id` VARCHAR(36) NOT NULL,
    `requestedById` VARCHAR(36) NOT NULL,
    `handledById` VARCHAR(36) NULL,
    `type` ENUM('ACCESS', 'EXPORT', 'CORRECTION', 'DELETION') NOT NULL,
    `status` ENUM('RECEIVED', 'IN_REVIEW', 'COMPLETED', 'REJECTED') NOT NULL DEFAULT 'RECEIVED',
    `notes` TEXT NULL,
    `resolution` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `completedAt` DATETIME(3) NULL,

    INDEX `DataSubjectRequest_requestedById_status_idx`(`requestedById`, `status`),
    INDEX `DataSubjectRequest_status_createdAt_idx`(`status`, `createdAt`),
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
ALTER TABLE `AuditLog` ADD CONSTRAINT `AuditLog_performedById_fkey` FOREIGN KEY (`performedById`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
