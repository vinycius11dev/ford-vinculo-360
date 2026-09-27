import { VehicleCondition } from "@prisma/client";
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Length,
  Max,
  Min,
  MinLength,
} from "class-validator";

export class AddStockVehicleDto {
  @IsString() @Length(17, 17) vin!: string;
  @IsOptional() @IsString() plate?: string;
  @IsString() model!: string;
  @IsString() @MinLength(1) version!: string;
  @IsString() @MinLength(2) exteriorColor!: string;
  @IsString() @MinLength(2) interiorColor!: string;
  @IsString() @MinLength(2) engine!: string;
  @IsString() @MinLength(2) fuelType!: string;
  @IsString() @MinLength(2) transmission!: string;
  @IsString() @MinLength(2) drive!: string;
  @IsOptional() @IsString() power?: string;
  @IsInt() @Min(2) @Max(6) doors!: number;
  @IsInt() @Min(1) @Max(9) seats!: number;
  @IsOptional() @IsString() features?: string;
  @IsOptional() @IsString() imageUrl?: string;
  @IsInt() @Min(1990) modelYear!: number;
  @IsInt() @Min(1990) manufactureYear!: number;
  @IsOptional() @IsInt() @Min(0) currentMileage?: number;
  @IsEnum(VehicleCondition) condition!: VehicleCondition;
  @IsInt() @Min(0) listPrice!: number;
  @IsOptional() @IsString() stockDealershipId?: string;
}
