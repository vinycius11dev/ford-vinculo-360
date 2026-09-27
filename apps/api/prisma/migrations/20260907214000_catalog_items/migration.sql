CREATE TABLE `CatalogItem` (
    `id` VARCHAR(36) NOT NULL,
    `slug` VARCHAR(120) NOT NULL,
    `name` VARCHAR(120) NOT NULL,
    `category` VARCHAR(80) NOT NULL,
    `summary` VARCHAR(240) NOT NULL,
    `description` TEXT NOT NULL,
    `highlights` TEXT NULL,
    `imageUrl` VARCHAR(300) NULL,
    `priceLabel` VARCHAR(80) NULL,
    `ctaLabel` VARCHAR(80) NOT NULL DEFAULT 'Tenho interesse',
    `sortOrder` INTEGER NOT NULL DEFAULT 0,
    `published` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `CatalogItem_slug_key`(`slug`),
    INDEX `CatalogItem_published_sortOrder_idx`(`published`, `sortOrder`),
    PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
