import { DataRequestStatus } from "@prisma/client";
import { IsEnum, IsOptional, IsString } from "class-validator";

export class UpdateDataRequestDto {
  @IsEnum(DataRequestStatus) status!: DataRequestStatus;
  @IsOptional() @IsString() resolution?: string;
}
