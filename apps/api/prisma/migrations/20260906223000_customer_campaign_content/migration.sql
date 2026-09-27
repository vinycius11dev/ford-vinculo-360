ALTER TABLE `Campaign`
    ADD COLUMN `publicTitle` VARCHAR(191) NULL,
    ADD COLUMN `publicDescription` TEXT NULL,
    ADD COLUMN `publicCtaLabel` VARCHAR(80) NULL,
    ADD COLUMN `publicCtaLink` VARCHAR(255) NULL;
