ALTER TABLE `User`
  MODIFY COLUMN `fordRelationship` VARCHAR(20) NOT NULL DEFAULT 'UNKNOWN';

UPDATE `User`
  SET `fordRelationship` = 'UNKNOWN'
  WHERE `fordRelationship` = 'NEW_TO_FORD';
