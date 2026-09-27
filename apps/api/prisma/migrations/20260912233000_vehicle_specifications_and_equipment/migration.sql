ALTER TABLE `VehicleModel`
  ADD COLUMN `technicalSpecifications` JSON NULL,
  ADD COLUMN `standardEquipment` JSON NULL;

ALTER TABLE `CatalogItem`
  ADD COLUMN `configurationDetails` JSON NULL,
  ADD COLUMN `equipment` JSON NULL;
