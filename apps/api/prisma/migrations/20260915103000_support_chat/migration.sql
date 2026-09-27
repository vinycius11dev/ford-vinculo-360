-- CreateTable
CREATE TABLE `SupportMessage` (
    `id` VARCHAR(36) NOT NULL,
    `ticketId` VARCHAR(36) NOT NULL,
    `senderId` VARCHAR(36) NOT NULL,
    `body` TEXT NOT NULL,
    `readAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `SupportMessage_ticketId_createdAt_idx`(`ticketId`, `createdAt`),
    INDEX `SupportMessage_ticketId_readAt_idx`(`ticketId`, `readAt`),
    INDEX `SupportMessage_senderId_createdAt_idx`(`senderId`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Keep the original ticket text as the first message in every existing conversation.
INSERT INTO `SupportMessage` (`id`, `ticketId`, `senderId`, `body`, `readAt`, `createdAt`)
SELECT UUID(), `id`, `requesterId`, `message`,
       CASE WHEN `status` IN ('RESOLVED', 'CLOSED') THEN `updatedAt` ELSE NULL END,
       `createdAt`
FROM `SupportTicket`;

-- AddForeignKey
ALTER TABLE `SupportMessage` ADD CONSTRAINT `SupportMessage_ticketId_fkey` FOREIGN KEY (`ticketId`) REFERENCES `SupportTicket`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SupportMessage` ADD CONSTRAINT `SupportMessage_senderId_fkey` FOREIGN KEY (`senderId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
