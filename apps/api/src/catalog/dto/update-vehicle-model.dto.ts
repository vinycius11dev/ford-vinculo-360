import { IsBoolean, IsInt, IsObject, IsOptional, IsString, Max, MaxLength, Min, MinLength } from "class-validator";

export class UpdateVehicleModelDto {
  @IsOptional() @IsString() @MaxLength(120) slug?: string;
  @IsOptional() @IsString() @MinLength(2) @MaxLength(120) name?: string;
  @IsOptional() @IsString() @MaxLength(40) modelCode?: string;
  @IsOptional() @IsInt() @Min(1900) @Max(2200) modelYear?: number;
  @IsOptional() @IsString() @MinLength(2) @MaxLength(80) category?: string;
  @IsOptional() @IsString() @MinLength(4) @MaxLength(240) summary?: string;
  @IsOptional() @IsString() @MinLength(4) description?: string;
  @IsOptional() @IsString() @MaxLength(160) dimensions?: string;
  @IsOptional() @IsInt() @Min(1) @Max(20) seats?: number;
  @IsOptional() @IsInt() @Min(2) @Max(6) doors?: number;
  @IsOptional() @IsString() @MaxLength(100) warrantyLabel?: string;
  @IsOptional() @IsInt() @Min(0) @Max(2000000000) basePrice?: number;
  @IsOptional() @IsString() @MaxLength(300) imageUrl?: string;
  @IsOptional() @IsObject() technicalSpecifications?: Record<string, unknown>;
  @IsOptional() @IsObject() standardEquipment?: Record<string, unknown>;
  @IsOptional() @IsBoolean() published?: boolean;
}
