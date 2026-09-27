import { IsBoolean, IsOptional, IsString } from "class-validator";

export class UpdateConsentDto {
  @IsBoolean() granted!: boolean;
  @IsOptional() @IsString() source?: string;
}
