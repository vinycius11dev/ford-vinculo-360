-- DropIndex
DROP INDEX `Booking_userId_fkey` ON `booking`;

-- DropIndex
DROP INDEX `Booking_vehicleId_fkey` ON `booking`;

-- DropIndex
DROP INDEX `CampaignTarget_vehicleId_fkey` ON `campaigntarget`;

-- DropIndex
DROP INDEX `PointTransaction_serviceOrderId_fkey` ON `pointtransaction`;

-- DropIndex
DROP INDEX `ServiceOrder_dealershipId_fkey` ON `serviceorder`;

-- DropIndex
DROP INDEX `Vehicle_originDealershipId_fkey` ON `vehicle`;

-- DropIndex
DROP INDEX `Voucher_loyaltyAccountId_fkey` ON `voucher`;

-- CreateTable
CREATE TABLE `RepurchaseLead` (
    `id` VARCHAR(36) NOT NULL,
    `vehicleId` VARCHAR(36) NOT NULL,
    `ownerId` VARCHAR(36) NULL,
    `dealershipId` VARCHAR(36) NOT NULL,
    `createdById` VARCHAR(36) NULL,
    `score` INTEGER NOT NULL,
    `estimatedValue` INTEGER NOT NULL,
    `status` ENUM('NEW', 'CONTACTED', 'QUALIFIED', 'WON', 'LOST') NOT NULL DEFAULT 'NEW',
    `notes` VARCHAR(191) NULL,
    `contactedAt` DATETIME(3) NULL,
    `closedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `RepurchaseLead_dealershipId_status_idx`(`dealershipId`, `status`),
    INDEX `RepurchaseLead_ownerId_idx`(`ownerId`),
    UNIQUE INDEX `RepurchaseLead_vehicleId_dealershipId_key`(`vehicleId`, `dealershipId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `RepurchaseLeadEvent` (
    `id` VARCHAR(36) NOT NULL,
    `leadId` VARCHAR(36) NOT NULL,
    `performedById` VARCHAR(36) NULL,
    `fromStatus` ENUM('NEW', 'CONTACTED', 'QUALIFIED', 'WON', 'LOST') NULL,
    `toStatus` ENUM('NEW', 'CONTACTED', 'QUALIFIED', 'WON', 'LOST') NOT NULL,
    `notes` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `RepurchaseLeadEvent_leadId_createdAt_idx`(`leadId`, `createdAt`),
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
ALTER TABLE `AuditLog` ADD CONSTRAINT `AuditLog_performedById_fkey` FOREIGN KEY (`performedById`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
