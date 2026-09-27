ALTER TABLE `Vehicle`
  ADD COLUMN `sourceSystem` VARCHAR(80) NULL,
  ADD COLUMN `externalId` VARCHAR(120) NULL;

CREATE UNIQUE INDEX `Vehicle_sourceSystem_externalId_key`
  ON `Vehicle`(`sourceSystem`, `externalId`);

ALTER TABLE `ServiceOrder`
  ADD COLUMN `sourceSystem` VARCHAR(80) NULL,
  ADD COLUMN `externalId` VARCHAR(120) NULL;

CREATE UNIQUE INDEX `ServiceOrder_sourceSystem_externalId_key`
  ON `ServiceOrder`(`sourceSystem`, `externalId`);
