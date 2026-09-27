-- Governança humana para recomendações de retenção geradas pela IA.
CREATE TABLE `AiRecommendationReview` (
    `id` VARCHAR(36) NOT NULL,
    `vehicleId` VARCHAR(36) NOT NULL,
    `reviewedById` VARCHAR(36) NOT NULL,
    `decision` ENUM('APPROVED', 'DISMISSED') NOT NULL,
    `reason` TEXT NULL,
    `score` INTEGER NOT NULL,
    `classification` VARCHAR(20) NOT NULL,
    `modelVersion` VARCHAR(100) NOT NULL,
    `modelSource` VARCHAR(40) NOT NULL,
    `reviewedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `AiRecommendationReview_vehicleId_modelVersion_key`(`vehicleId`, `modelVersion`),
    INDEX `AiRecommendationReview_vehicleId_reviewedAt_idx`(`vehicleId`, `reviewedAt`),
    INDEX `AiRecommendationReview_reviewedById_reviewedAt_idx`(`reviewedById`, `reviewedAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `AiRecommendationReview`
    ADD CONSTRAINT `AiRecommendationReview_vehicleId_fkey`
    FOREIGN KEY (`vehicleId`) REFERENCES `Vehicle`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `AiRecommendationReview`
    ADD CONSTRAINT `AiRecommendationReview_reviewedById_fkey`
    FOREIGN KEY (`reviewedById`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
