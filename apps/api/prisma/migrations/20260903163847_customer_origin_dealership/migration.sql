-- AlterTable
ALTER TABLE `user` ADD COLUMN `registeredByDealershipId` VARCHAR(36) NULL;

-- CreateIndex
CREATE INDEX `User_registeredByDealershipId_idx` ON `User`(`registeredByDealershipId`);

-- AddForeignKey
ALTER TABLE `User` ADD CONSTRAINT `User_registeredByDealershipId_fkey` FOREIGN KEY (`registeredByDealershipId`) REFERENCES `Dealership`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

