import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { MessagingModule } from "../messaging/messaging.module";
import { SupportController } from "./support.controller";
import { SupportService } from "./support.service";

@Module({
  imports: [AuthModule, MessagingModule],
  controllers: [SupportController],
  providers: [SupportService],
})
export class SupportModule {}
