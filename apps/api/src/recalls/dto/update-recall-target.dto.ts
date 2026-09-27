import { RecallTargetStatus } from "@prisma/client";
import { IsEnum } from "class-validator";

export class UpdateRecallTargetDto {
  @IsEnum(RecallTargetStatus) status!: RecallTargetStatus;
}
