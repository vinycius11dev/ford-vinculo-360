import { Type } from "class-transformer";
import {
  ArrayMaxSize,
  IsArray,
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Length,
  Matches,
  Min,
  ValidateNested,
} from "class-validator";
import { ServiceOrderStatus } from "@prisma/client";

const VIN_PATTERN = /^[A-HJ-NPR-Z0-9]{17}$/i;

export class PilotVehicleRowDto {
  @IsString()
  @Length(1, 120)
  externalId!: string;

  @IsString()
  @Length(17, 17)
  @Matches(VIN_PATTERN, { message: "VIN deve conter 17 caracteres válidos." })
  vin!: string;

  @IsString()
  @Length(2, 120)
  model!: string;

  @IsInt()
  @Min(1900)
  modelYear!: number;

  @IsInt()
  @Min(1900)
  manufactureYear!: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  currentMileage?: number;

  @IsOptional()
  @IsString()
  @Length(7, 8)
  plate?: string;

  @IsOptional()
  @IsString()
  dealershipId?: string;

  @IsOptional()
  @IsDateString()
  warrantyUntil?: string;
}

export class PilotServiceOrderRowDto {
  @IsString()
  @Length(1, 120)
  externalId!: string;

  @IsString()
  @Length(17, 17)
  @Matches(VIN_PATTERN, { message: "VIN deve conter 17 caracteres válidos." })
  vin!: string;

  @IsInt()
  @Min(0)
  mileage!: number;

  @IsOptional()
  @IsEnum(ServiceOrderStatus)
  status?: ServiceOrderStatus;

  @IsOptional()
  @IsString()
  @Length(1, 255)
  description?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  amount?: number;

  @IsOptional()
  @IsDateString()
  completedAt?: string;

  @IsOptional()
  @IsString()
  dealershipId?: string;
}

export class PilotImportDto {
  @IsString()
  @Length(2, 80)
  @Matches(/^[A-Za-z0-9._-]+$/, {
    message: "sourceSystem deve usar apenas letras, números, ponto, hífen ou sublinhado.",
  })
  sourceSystem!: string;

  @IsArray()
  @ArrayMaxSize(500)
  @ValidateNested({ each: true })
  @Type(() => PilotVehicleRowDto)
  vehicles: PilotVehicleRowDto[] = [];

  @IsArray()
  @ArrayMaxSize(1000)
  @ValidateNested({ each: true })
  @Type(() => PilotServiceOrderRowDto)
  serviceOrders: PilotServiceOrderRowDto[] = [];
}
