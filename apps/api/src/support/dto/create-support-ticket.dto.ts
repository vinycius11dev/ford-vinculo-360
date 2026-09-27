import {
  SupportTicketCategory,
  SupportTicketPriority,
} from "@prisma/client";
import { IsEnum, IsString, MaxLength, MinLength } from "class-validator";

export class CreateSupportTicketDto {
  @IsString()
  @MinLength(5)
  @MaxLength(160)
  subject!: string;

  @IsString()
  @MinLength(15)
  @MaxLength(5000)
  message!: string;

  @IsEnum(SupportTicketCategory)
  category!: SupportTicketCategory;

  @IsEnum(SupportTicketPriority)
  priority!: SupportTicketPriority;
}
