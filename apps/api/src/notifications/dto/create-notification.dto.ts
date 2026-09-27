import { NotificationType } from "@prisma/client";
import { IsEnum, IsOptional, IsString, MinLength } from "class-validator";

export class CreateNotificationDto {
  @IsEnum(NotificationType) type!: NotificationType;
  @IsString() @MinLength(3) title!: string;
  @IsString() @MinLength(3) message!: string;
  @IsOptional() @IsString() link?: string;
  @IsOptional() @IsString() userId?: string;
  @IsOptional() @IsString() dealershipId?: string;
}
