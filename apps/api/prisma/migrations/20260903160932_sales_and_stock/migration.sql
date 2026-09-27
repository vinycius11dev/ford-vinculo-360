-- AlterTable
ALTER TABLE `serviceorder` ADD COLUMN `amount` INTEGER NULL;

-- AlterTable
ALTER TABLE `vehicle` ADD COLUMN `condition` ENUM('NEW', 'USED') NOT NULL DEFAULT 'NEW',
    ADD COLUMN `listPrice` INTEGER NULL,
    ADD COLUMN `saleStatus` ENUM('IN_STOCK', 'RESERVED', 'SOLD') NULL,
    ADD COLUMN `stockDealershipId` VARCHAR(36) NULL,
    ADD COLUMN `stockSince` DATETIME(3) NULL,
    ADD COLUMN `warrantyUntil` DATETIME(3) NULL;

-- CreateTable
CREATE TABLE `Sale` (
    `id` VARCHAR(36) NOT NULL,
    `vehicleId` VARCHAR(36) NOT NULL,
    `dealershipId` VARCHAR(36) NOT NULL,
    `customerId` VARCHAR(36) NOT NULL,
    `soldById` VARCHAR(36) NULL,
    `tradeInVehicleId` VARCHAR(36) NULL,
    `repurchaseLeadId` VARCHAR(36) NULL,
    `condition` ENUM('NEW', 'USED') NOT NULL,
    `price` INTEGER NOT NULL,
    `tradeInValue` INTEGER NULL,
    `warrantyMonths` INTEGER NOT NULL DEFAULT 36,
    `notes` TEXT NULL,
    `soldAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `Sale_dealershipId_soldAt_idx`(`dealershipId`, `soldAt`),
    INDEX `Sale_customerId_idx`(`customerId`),
    PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE INDEX `Vehicle_saleStatus_stockDealershipId_idx` ON `Vehicle`(`saleStatus`, `stockDealershipId`);

-- AddForeignKey
ALTER TABLE `Vehicle` ADD CONSTRAINT `Vehicle_stockDealershipId_fkey` FOREIGN KEY (`stockDealershipId`) REFERENCES `Dealership`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Sale` ADD CONSTRAINT `Sale_vehicleId_fkey` FOREIGN KEY (`vehicleId`) REFERENCES `Vehicle`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Sale` ADD CONSTRAINT `Sale_tradeInVehicleId_fkey` FOREIGN KEY (`tradeInVehicleId`) REFERENCES `Vehicle`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Sale` ADD CONSTRAINT `Sale_dealershipId_fkey` FOREIGN KEY (`dealershipId`) REFERENCES `Dealership`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Sale` ADD CONSTRAINT `Sale_customerId_fkey` FOREIGN KEY (`customerId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Sale` ADD CONSTRAINT `Sale_soldById_fkey` FOREIGN KEY (`soldById`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Sale` ADD CONSTRAINT `Sale_repurchaseLeadId_fkey` FOREIGN KEY (`repurchaseLeadId`) REFERENCES `RepurchaseLead`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

