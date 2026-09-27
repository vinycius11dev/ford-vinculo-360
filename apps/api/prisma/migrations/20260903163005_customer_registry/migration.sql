-- DropIndex
DROP INDEX `User_cpfHash_key` ON `user`;

-- AlterTable
ALTER TABLE `user` DROP COLUMN `cpfHash`,
    ADD COLUMN `addressCity` VARCHAR(191) NULL,
    ADD COLUMN `addressComplement` VARCHAR(191) NULL,
    ADD COLUMN `addressDistrict` VARCHAR(191) NULL,
    ADD COLUMN `addressNumber` VARCHAR(10) NULL,
    ADD COLUMN `addressState` VARCHAR(2) NULL,
    ADD COLUMN `addressStreet` VARCHAR(191) NULL,
    ADD COLUMN `addressZip` VARCHAR(8) NULL,
    ADD COLUMN `birthDate` DATETIME(3) NULL,
    ADD COLUMN `cpf` VARCHAR(11) NULL,
    ADD COLUMN `rg` VARCHAR(20) NULL,
    ADD COLUMN `rgIssuer` VARCHAR(20) NULL;

-- CreateIndex
CREATE UNIQUE INDEX `User_cpf_key` ON `User`(`cpf`);

