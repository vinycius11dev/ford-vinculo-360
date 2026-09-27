ALTER TABLE `OutboundMessage`
  MODIFY COLUMN `templateKey` ENUM('TEAM_INVITATION', 'PASSWORD_RESET', 'CAMPAIGN_OFFER') NOT NULL,
  ADD COLUMN `campaignTargetId` VARCHAR(36) NULL;

CREATE INDEX `OutboundMessage_campaignTargetId_idx`
  ON `OutboundMessage`(`campaignTargetId`);

ALTER TABLE `OutboundMessage`
  ADD CONSTRAINT `OutboundMessage_campaignTargetId_fkey`
  FOREIGN KEY (`campaignTargetId`) REFERENCES `CampaignTarget`(`id`)
  ON DELETE SET NULL ON UPDATE CASCADE;
