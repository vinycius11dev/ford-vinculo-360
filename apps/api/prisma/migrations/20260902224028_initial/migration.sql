-- CreateTable
CREATE TABLE `User` (
    `id` VARCHAR(36) NOT NULL,
    `email` VARCHAR(191) NOT NULL,
    `fullName` VARCHAR(191) NOT NULL,
    `phone` VARCHAR(191) NULL,
    `cpfHash` VARCHAR(191) NULL,
    `role` ENUM('CUSTOMER', 'DEALERSHIP_AGENT', 'DEALERSHIP_MANAGER', 'FORD_ADMIN') NOT NULL DEFAULT 'CUSTOMER',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `User_email_key`(`email`),
    UNIQUE INDEX `User_cpfHash_key`(`cpfHash`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Dealership` (
    `id` VARCHAR(36) NOT NULL,
    `legalName` VARCHAR(191) NOT NULL,
    `tradeName` VARCHAR(191) NOT NULL,
    `cnpj` VARCHAR(191) NOT NULL,
    `city` VARCHAR(191) NOT NULL,
    `state` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `Dealership_cnpj_key`(`cnpj`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Vehicle` (
    `id` VARCHAR(36) NOT NULL,
    `vin` VARCHAR(17) NOT NULL,
    `plate` VARCHAR(8) NULL,
    `model` VARCHAR(191) NOT NULL,
    `modelYear` INTEGER NOT NULL,
    `manufactureYear` INTEGER NOT NULL,
    `currentMileage` INTEGER NOT NULL DEFAULT 0,
    `originDealershipId` VARCHAR(36) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Vehicle_vin_key`(`vin`),
    UNIQUE INDEX `Vehicle_plate_key`(`plate`),
    INDEX `Vehicle_model_modelYear_idx`(`model`, `modelYear`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `VehicleOwnership` (
    `id` VARCHAR(36) NOT NULL,
    `vehicleId` VARCHAR(36) NOT NULL,
    `userId` VARCHAR(36) NOT NULL,
    `status` ENUM('ACTIVE', 'ENDED', 'PENDING_VERIFICATION') NOT NULL DEFAULT 'PENDING_VERIFICATION',
    `startedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `endedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `VehicleOwnership_vehicleId_status_idx`(`vehicleId`, `status`),
    INDEX `VehicleOwnership_userId_status_idx`(`userId`, `status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ServiceOrder` (
    `id` VARCHAR(36) NOT NULL,
    `vehicleId` VARCHAR(36) NOT NULL,
    `dealershipId` VARCHAR(36) NOT NULL,
    `mileage` INTEGER NOT NULL,
    `status` ENUM('OPEN', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED') NOT NULL DEFAULT 'OPEN',
    `description` VARCHAR(191) NULL,
    `completedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `ServiceOrder_vehicleId_completedAt_idx`(`vehicleId`, `completedAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `LoyaltyAccount` (
    `id` VARCHAR(36) NOT NULL,
    `userId` VARCHAR(36) NOT NULL,
    `balance` INTEGER NOT NULL DEFAULT 0,
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `LoyaltyAccount_userId_key`(`userId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `PointTransaction` (
    `id` VARCHAR(36) NOT NULL,
    `loyaltyAccountId` VARCHAR(36) NOT NULL,
    `serviceOrderId` VARCHAR(36) NULL,
    `amount` INTEGER NOT NULL,
    `reason` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `PointTransaction_loyaltyAccountId_createdAt_idx`(`loyaltyAccountId`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Voucher` (
    `id` VARCHAR(36) NOT NULL,
    `loyaltyAccountId` VARCHAR(36) NOT NULL,
    `code` VARCHAR(191) NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `pointsCost` INTEGER NOT NULL,
    `status` ENUM('AVAILABLE', 'REDEEMED', 'EXPIRED') NOT NULL DEFAULT 'AVAILABLE',
    `expiresAt` DATETIME(3) NULL,
    `redeemedAt` DATETIME(3) NULL,

    UNIQUE INDEX `Voucher_code_key`(`code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Booking` (
    `id` VARCHAR(36) NOT NULL,
    `vehicleId` VARCHAR(36) NOT NULL,
    `userId` VARCHAR(36) NOT NULL,
    `dealershipId` VARCHAR(36) NOT NULL,
    `requestedFor` DATETIME(3) NOT NULL,
    `status` ENUM('REQUESTED', 'CONFIRMED', 'COMPLETED', 'CANCELLED') NOT NULL DEFAULT 'REQUESTED',
    `notes` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `Booking_dealershipId_requestedFor_idx`(`dealershipId`, `requestedFor`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Campaign` (
    `id` VARCHAR(36) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `description` VARCHAR(191) NOT NULL,
    `startsAt` DATETIME(3) NOT NULL,
    `endsAt` DATETIME(3) NOT NULL,
    `active` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `CampaignTarget` (
    `id` VARCHAR(36) NOT NULL,
    `campaignId` VARCHAR(36) NOT NULL,
    `vehicleId` VARCHAR(36) NOT NULL,
    `sentAt` DATETIME(3) NULL,
    `convertedAt` DATETIME(3) NULL,

    UNIQUE INDEX `CampaignTarget_campaignId_vehicleId_key`(`campaignId`, `vehicleId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

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
