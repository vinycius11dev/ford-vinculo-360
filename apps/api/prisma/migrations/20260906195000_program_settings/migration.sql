CREATE TABLE `ProgramSettings` (
    `id` VARCHAR(36) NOT NULL,
    `minimumPoints` INTEGER NOT NULL DEFAULT 100,
    `mileagePerPoint` INTEGER NOT NULL DEFAULT 100,
    `updatedAt` DATETIME(3) NOT NULL,
    PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
