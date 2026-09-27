import { DataRequestType } from "@prisma/client";
import { IsEnum, IsOptional, IsString } from "class-validator";

export class CreateDataRequestDto {
  @IsEnum(DataRequestType) type!: DataRequestType;
  @IsOptional() @IsString() notes?: string;
}
