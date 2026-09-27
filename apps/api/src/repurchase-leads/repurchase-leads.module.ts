import { Module } from "@nestjs/common";
import { RepurchaseLeadsController } from "./repurchase-leads.controller";
import { RepurchaseLeadsService } from "./repurchase-leads.service";

@Module({
  controllers: [RepurchaseLeadsController],
  providers: [RepurchaseLeadsService],
})
export class RepurchaseLeadsModule {}
