import { RepurchaseLeadStatus } from "@prisma/client";
import { IsEnum, IsOptional, IsString } from "class-validator";

export class UpdateRepurchaseLeadDto {
  @IsOptional()
  @IsEnum(RepurchaseLeadStatus)
  status?: RepurchaseLeadStatus;

  @IsOptional()
  @IsString()
  notes?: string;
}
