import { VehicleCondition } from "@prisma/client";
import { ArrayMaxSize, ArrayMinSize, IsArray, IsEnum, IsInt, IsOptional, IsString, Length, Matches, Min, MinLength } from "class-validator";

export class CreateVehicleBatchDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(1000)
  @IsString({ each: true })
  @Length(17, 17, { each: true })
  @Matches(/^[A-HJ-NPR-Z0-9]{17}$/i, { each: true, message: "Cada VIN deve conter 17 caracteres válidos." })
  vins!: string[];

  @IsString() @MinLength(1) catalogItemId!: string;
  @IsInt() @Min(1900) manufactureYear!: number;
  @IsOptional() @IsInt() @Min(0) currentMileage?: number;
  @IsEnum(VehicleCondition) condition!: VehicleCondition;
  @IsOptional() @IsInt() @Min(0) listPrice?: number;
  @IsOptional() @IsString() stockDealershipId?: string;
}
