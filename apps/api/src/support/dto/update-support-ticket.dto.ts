import { SupportTicketStatus } from "@prisma/client";
import { IsEnum, IsOptional, IsString, MaxLength } from "class-validator";

export class UpdateSupportTicketDto {
  @IsEnum(SupportTicketStatus)
  status!: SupportTicketStatus;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  resolution?: string;
}
