import {
  ArrayNotEmpty,
  ArrayUnique,
  IsArray,
  IsInt,
  IsOptional,
  IsString,
  Length,
  Matches,
  Max,
  Min,
  MinLength,
} from "class-validator";

export class UpdateDealershipDto {
  @IsOptional() @IsString() @MinLength(3) legalName?: string;
  @IsOptional() @IsString() @MinLength(2) tradeName?: string;
  @IsOptional() @IsString() @MinLength(2) city?: string;
  @IsOptional() @IsString() @Length(2, 2) state?: string;
  @IsOptional() @IsString() @MinLength(3) timezone?: string;
  @IsOptional()
  @IsArray()
  @ArrayNotEmpty()
  @ArrayUnique()
  @IsInt({ each: true })
  @Min(0, { each: true })
  @Max(6, { each: true })
  businessDays?: number[];
  @IsOptional()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/)
  openingTime?: string;
  @IsOptional()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/)
  closingTime?: string;
  @IsOptional() @IsInt() @Min(15) @Max(240) slotDurationMinutes?: number;
  @IsOptional() @IsInt() @Min(1) @Max(50) simultaneousCapacity?: number;
}
