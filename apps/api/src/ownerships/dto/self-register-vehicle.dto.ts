import { Transform } from "class-transformer";
import {
  IsBoolean,
  IsEmail,
  IsInt,
  IsOptional,
  IsString,
  Length,
  Matches,
  Max,
  Min,
} from "class-validator";

const CURRENT_YEAR = new Date().getFullYear() + 1;

/**
 * Dados informados por quem ainda não existe na base da rede. Eles nunca
 * ativam uma propriedade automaticamente: criam uma solicitação para análise.
 */
export class SelfRegisterVehicleDto {
  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  @IsString()
  @Length(3, 120)
  fullName!: string;

  @Transform(({ value }) => (typeof value === "string" ? value.trim().toLowerCase() : value))
  @IsEmail()
  email!: string;

  @Transform(({ value }) =>
    typeof value === "string" ? value.replace(/\D/g, "").slice(0, 13) : value,
  )
  @IsOptional()
  @Matches(/^\d{10,13}$/, { message: "Informe um telefone válido com DDD." })
  phone?: string;

  @Transform(({ value }) =>
    typeof value === "string" ? value.toUpperCase().replace(/[^A-Z0-9]/g, "") : value,
  )
  @Matches(/^[A-HJ-NPR-Z0-9]{17}$/, {
    message: "VIN deve conter 17 caracteres válidos.",
  })
  vin!: string;

  @Transform(({ value }) =>
    typeof value === "string"
      ? value.toUpperCase().replace(/[^A-Z0-9]/g, "")
      : value,
  )
  @IsOptional()
  @Matches(/^[A-Z]{3}[0-9][A-Z0-9][0-9]{2}$/, {
    message: "Informe uma placa brasileira válida.",
  })
  plate?: string;

  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  @IsString()
  @Length(2, 80)
  model!: string;

  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  @IsString()
  @Length(2, 80)
  exteriorColor!: string;

  @Transform(({ value }) => Number(value))
  @IsInt()
  @Min(1980)
  @Max(CURRENT_YEAR)
  manufactureYear!: number;

  @Transform(({ value }) => Number(value))
  @IsInt()
  @Min(1980)
  @Max(CURRENT_YEAR)
  modelYear!: number;

  @Transform(({ value }) => Number(value))
  @IsInt()
  @Min(0)
  @Max(2_000_000)
  currentMileage!: number;

  @IsOptional()
  @IsString()
  @Length(20, 36)
  preferredDealershipId?: string;

  @IsBoolean()
  termsAccepted!: boolean;
}
