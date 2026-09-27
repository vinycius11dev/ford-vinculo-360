import { Type } from "class-transformer";
import {
  IsEmail,
  IsInt,
  IsOptional,
  IsString,
  Min,
  MinLength,
  ValidateNested,
} from "class-validator";

export class NewCustomerDto {
  @IsString() @MinLength(3) fullName!: string;
  @IsEmail() email!: string;
  @IsOptional() @IsString() phone?: string;
  /** Exigido na nota fiscal e no emplacamento. */
  @IsOptional() @IsString() cpf?: string;
}

export class RegisterSaleDto {
  /** Veículo do estoque que está sendo vendido. */
  @IsString() @MinLength(17) vin!: string;

  /** Cliente já cadastrado... */
  @IsOptional() @IsString() customerId?: string;
  /** ...ou cadastro feito no ato da venda. */
  @IsOptional()
  @ValidateNested()
  @Type(() => NewCustomerDto)
  customer?: NewCustomerDto;

  @IsOptional() @IsInt() @Min(0) warrantyMonths?: number;

  /** Usado recebido na troca, que volta ao estoque com o histórico dele. */
  @IsOptional() @IsString() tradeInVin?: string;
  @IsOptional() @IsInt() @Min(0) tradeInValue?: number;

  /** Oportunidade de recompra que originou a venda. */
  @IsOptional() @IsString() repurchaseLeadId?: string;

  @IsOptional() @IsString() notes?: string;
}
