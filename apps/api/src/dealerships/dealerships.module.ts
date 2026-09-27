import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { DealershipsController } from "./dealerships.controller";
import { DealershipsService } from "./dealerships.service";

@Module({
  imports: [AuthModule],
  controllers: [DealershipsController],
  providers: [DealershipsService],
})
export class DealershipsModule {}
