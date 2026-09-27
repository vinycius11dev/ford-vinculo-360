-- Catálogo = configuração reutilizável; veículo = unidade física identificada
-- pelo VIN. Várias unidades podem compartilhar versão e cor.
ALTER TABLE `catalogitem`
  ADD COLUMN `doors` INTEGER NULL,
  ADD COLUMN `exteriorColors` JSON NULL,
  ADD COLUMN `interiorColors` JSON NULL;

UPDATE `catalogitem`
SET
  `doors` = COALESCE(`doors`, 4),
  `exteriorColors` = JSON_ARRAY('Branco Ártico', 'Preto Astúrias', 'Azul Belize', 'Cinza Dover', 'Prata Orvalho', 'Vermelho Lucid'),
  `interiorColors` = JSON_ARRAY('Preto', 'Preto premium', 'Caramelo', 'Cinza claro')
WHERE `exteriorColors` IS NULL OR `interiorColors` IS NULL;

ALTER TABLE `vehicle`
  ADD COLUMN `catalogItemId` VARCHAR(36) NULL,
  ADD INDEX `vehicle_catalogItemId_idx` (`catalogItemId`),
  ADD CONSTRAINT `vehicle_catalogItemId_fkey`
    FOREIGN KEY (`catalogItemId`) REFERENCES `catalogitem`(`id`)
    ON DELETE SET NULL ON UPDATE CASCADE;
