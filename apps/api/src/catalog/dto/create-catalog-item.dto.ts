import {
  IsBoolean,
  IsArray,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from "class-validator";

export class CreateCatalogItemDto {
  @IsOptional() @IsString() @MaxLength(120) slug?: string;
  @IsString() @MinLength(1) modelId!: string;
  @IsString() @MinLength(1) @MaxLength(120) version!: string;
  @IsString() @MinLength(2) @MaxLength(80) exteriorColor!: string;
  @IsString() @MinLength(2) @MaxLength(80) interiorColor!: string;
  @IsOptional() @IsInt() @Min(0) @Max(2000000000) additionalPrice?: number;
  @IsOptional() @IsObject() configurationDetails?: Record<string, unknown>;
  @IsOptional() @IsObject() equipment?: Record<string, unknown>;
  @IsOptional() @IsString() @MinLength(2) @MaxLength(120) name?: string;
  @IsOptional() @IsString() @MaxLength(40) modelCode?: string;
  @IsOptional() @IsInt() @Min(1900) @Max(2200) modelYear?: number;
  @IsOptional() @IsString() @MinLength(2) @MaxLength(80) category?: string;
  @IsOptional() @IsString() @MinLength(4) @MaxLength(240) summary?: string;
  @IsOptional() @IsString() @MinLength(4) description?: string;
  @IsOptional() @IsString() @MaxLength(2000) highlights?: string;
  @IsOptional() @IsString() @MaxLength(100) engine?: string;
  @IsOptional() @IsString() @MaxLength(80) fuelType?: string;
  @IsOptional() @IsString() @MaxLength(80) transmission?: string;
  @IsOptional() @IsString() @MaxLength(80) drive?: string;
  @IsOptional() @IsString() @MaxLength(80) power?: string;
  @IsOptional() @IsString() @MaxLength(80) torque?: string;
  @IsOptional() @IsString() @MaxLength(100) consumption?: string;
  @IsOptional() @IsString() @MaxLength(100) rangeLabel?: string;
  @IsOptional() @IsString() @MaxLength(160) dimensions?: string;
  @IsOptional() @IsInt() @Min(1) @Max(20) seats?: number;
  @IsOptional() @IsInt() @Min(2) @Max(6) doors?: number;
  @IsOptional() @IsArray() @IsString({ each: true }) @MinLength(2, { each: true }) exteriorColors?: string[];
  @IsOptional() @IsArray() @IsString({ each: true }) @MinLength(2, { each: true }) interiorColors?: string[];
  @IsOptional() @IsString() @MaxLength(100) warrantyLabel?: string;
  @IsOptional() @IsString() @MaxLength(300) imageUrl?: string;
  @IsOptional() @IsString() @MaxLength(80) priceLabel?: string;
  @IsOptional() @IsString() @MaxLength(100) stockLabel?: string;
  @IsOptional() @IsString() @MaxLength(80) ctaLabel?: string;
  @IsOptional() @IsInt() @Min(0) @Max(100000) sortOrder?: number;
  @IsOptional() @IsBoolean() published?: boolean;
}
