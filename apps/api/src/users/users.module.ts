import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { MessagingModule } from "../messaging/messaging.module";
import { UsersController } from "./users.controller";
import { UsersService } from "./users.service";

@Module({
  imports: [AuthModule, MessagingModule],
  controllers: [UsersController],
  providers: [UsersService],
})
export class UsersModule {}
