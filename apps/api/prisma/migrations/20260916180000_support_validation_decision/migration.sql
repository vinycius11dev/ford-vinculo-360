ALTER TABLE `SupportTicket` ADD COLUMN `validationDecision` VARCHAR(10) NULL;

-- Recupera a decisão das validações já tratadas a partir da trilha de auditoria.
UPDATE `SupportTicket` t
JOIN `AuditLog` a
  ON a.`action` IN ('VEHICLE_OWNERSHIP_VALIDATED', 'VEHICLE_OWNERSHIP_REJECTED')
 AND JSON_UNQUOTE(JSON_EXTRACT(a.`metadata`, '$.supportTicketId')) = t.`id`
SET t.`validationDecision` = IF(a.`action` = 'VEHICLE_OWNERSHIP_VALIDATED', 'APPROVED', 'REJECTED')
WHERE t.`validationDecision` IS NULL;
