-- O cadastro do VIN passa a ser a fonte única do estoque e guarda a ficha
-- comercial completa da unidade física.
ALTER TABLE `vehicle`
    ADD COLUMN `version` VARCHAR(191) NULL,
    ADD COLUMN `exteriorColor` VARCHAR(191) NULL,
    ADD COLUMN `interiorColor` VARCHAR(191) NULL,
    ADD COLUMN `engine` VARCHAR(191) NULL,
    ADD COLUMN `fuelType` VARCHAR(191) NULL,
    ADD COLUMN `transmission` VARCHAR(191) NULL,
    ADD COLUMN `drive` VARCHAR(191) NULL,
    ADD COLUMN `power` VARCHAR(191) NULL,
    ADD COLUMN `doors` INTEGER NULL,
    ADD COLUMN `seats` INTEGER NULL,
    ADD COLUMN `features` TEXT NULL,
    ADD COLUMN `imageUrl` VARCHAR(300) NULL;

-- Cliente criado pela venda fica pendente até confirmar o e-mail e definir a
-- própria senha. Depois disso o vínculo já aparece no aplicativo.
ALTER TABLE `user`
    ADD COLUMN `passwordSetupRequired` BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE `outboundmessage`
    MODIFY `templateKey` ENUM(
      'TEAM_INVITATION',
      'CUSTOMER_ACTIVATION',
      'PASSWORD_RESET',
      'CAMPAIGN_OFFER',
      'EMAIL_TEST'
    ) NOT NULL;
