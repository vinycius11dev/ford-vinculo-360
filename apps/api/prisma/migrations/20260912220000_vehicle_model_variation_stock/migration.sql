-- Separa o modelo principal da configuração comercial reutilizável.
-- Uma configuração pode ser usada por até milhares de unidades físicas (VINs).
DROP TABLE IF EXISTS `VehicleModel`;

CREATE TABLE `VehicleModel` (
  `id` VARCHAR(36) NOT NULL,
  `slug` VARCHAR(120) NOT NULL,
  `name` VARCHAR(120) NOT NULL,
  `modelCode` VARCHAR(40) NULL,
  `modelYear` INTEGER NOT NULL,
  `category` VARCHAR(80) NOT NULL,
  `summary` VARCHAR(240) NOT NULL,
  `description` TEXT NOT NULL,
  `dimensions` VARCHAR(160) NULL,
  `seats` INTEGER NULL,
  `doors` INTEGER NULL,
  `warrantyLabel` VARCHAR(100) NULL,
  `basePrice` INTEGER NOT NULL DEFAULT 0,
  `imageUrl` VARCHAR(300) NULL,
  `published` BOOLEAN NOT NULL DEFAULT true,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,

  UNIQUE INDEX `VehicleModel_slug_key`(`slug`),
  UNIQUE INDEX `VehicleModel_name_modelYear_key`(`name`, `modelYear`),
  INDEX `VehicleModel_published_name_modelYear_idx`(`published`, `name`, `modelYear`),
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Preserva as configurações já existentes criando um modelo principal para
-- cada combinação de nome e ano.
INSERT INTO `VehicleModel` (
  `id`, `slug`, `name`, `modelCode`, `modelYear`, `category`, `summary`,
  `description`, `dimensions`, `seats`, `doors`, `warrantyLabel`, `basePrice`,
  `imageUrl`, `published`, `createdAt`, `updatedAt`
)
SELECT
  CONCAT('mdl_', LEFT(MD5(CONCAT(`name`, '|', COALESCE(MAX(`modelYear`), 2026))), 32)),
  CONCAT('model-', LEFT(MD5(CONCAT(`name`, '|', COALESCE(MAX(`modelYear`), 2026))), 24)),
  `name`, MIN(`modelCode`), COALESCE(MAX(`modelYear`), 2026), MIN(`category`),
  MIN(`summary`), MIN(`description`), MIN(`dimensions`), MAX(`seats`),
  MAX(`doors`), MIN(`warrantyLabel`), 0, MIN(`imageUrl`), MAX(`published`),
  MIN(`createdAt`), MAX(`updatedAt`)
FROM `CatalogItem`
GROUP BY `name`, `modelYear`;

ALTER TABLE `CatalogItem`
  ADD COLUMN `modelId` VARCHAR(36) NULL,
  ADD COLUMN `exteriorColor` VARCHAR(80) NULL,
  ADD COLUMN `interiorColor` VARCHAR(80) NULL,
  ADD COLUMN `additionalPrice` INTEGER NOT NULL DEFAULT 0;

UPDATE `CatalogItem` AS `variation`
INNER JOIN `VehicleModel` AS `model`
  ON `model`.`name` = `variation`.`name`
  AND `model`.`modelYear` = COALESCE(`variation`.`modelYear`, 2026)
SET
  `variation`.`modelId` = `model`.`id`,
  `variation`.`exteriorColor` = JSON_UNQUOTE(JSON_EXTRACT(`variation`.`exteriorColors`, '$[0]')),
  `variation`.`interiorColor` = JSON_UNQUOTE(JSON_EXTRACT(`variation`.`interiorColors`, '$[0]'));

ALTER TABLE `CatalogItem`
  MODIFY `modelId` VARCHAR(36) NOT NULL,
  ADD INDEX `CatalogItem_modelId_published_sortOrder_idx` (`modelId`, `published`, `sortOrder`),
  ADD CONSTRAINT `CatalogItem_modelId_fkey`
    FOREIGN KEY (`modelId`) REFERENCES `VehicleModel`(`id`)
    ON DELETE RESTRICT ON UPDATE CASCADE;
