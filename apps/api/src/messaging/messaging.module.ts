import { Module } from "@nestjs/common";
import { MessagingController } from "./messaging.controller";
import { MessagingService } from "./messaging.service";
import { ConsoleProvider } from "./providers/console.provider";
import { SmtpEmailProvider } from "./providers/smtp-email.provider";

@Module({
  controllers: [MessagingController],
  providers: [MessagingService, ConsoleProvider, SmtpEmailProvider],
  exports: [MessagingService],
})
export class MessagingModule {}
