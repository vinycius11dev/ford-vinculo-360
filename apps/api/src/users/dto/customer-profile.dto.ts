import {
  IsBoolean,
  IsDateString,
  IsEmail,
  IsIn,
  IsOptional,
  IsString,
  Length,
  Matches,
  MinLength,
} from "class-validator";

/** Mantém apenas os dígitos de documentos e CEP. */
export const onlyDigits = (value?: string | null) =>
  value ? value.replace(/\D/g, "") : "";

/** Validação real dos dígitos verificadores do CPF. */
export function isValidCpf(value: string) {
  const cpf = onlyDigits(value);
  if (cpf.length !== 11 || /^(\d)\1{10}$/.test(cpf)) return false;
  const digit = (slice: number) => {
    let total = 0;
    for (let index = 0; index < slice; index += 1)
      total += Number(cpf[index]) * (slice + 1 - index);
    const rest = (total * 10) % 11;
    return rest === 10 ? 0 : rest;
  };
  return digit(9) === Number(cpf[9]) && digit(10) === Number(cpf[10]);
}

/** Validação dos dois dígitos verificadores do CNPJ. */
export function isValidCnpj(value: string) {
  const cnpj = onlyDigits(value);
  if (cnpj.length !== 14 || /^(\d)\1{13}$/.test(cnpj)) return false;
  const calculateDigit = (base: string) => {
    let factor = base.length - 7;
    let total = 0;
    for (const digit of base) {
      total += Number(digit) * factor;
      factor -= 1;
      if (factor < 2) factor = 9;
    }
    const remainder = total % 11;
    return remainder < 2 ? 0 : 11 - remainder;
  };
  const first = calculateDigit(cnpj.slice(0, 12));
  const second = calculateDigit(`${cnpj.slice(0, 12)}${first}`);
  return cnpj.endsWith(`${first}${second}`);
}

export class CustomerProfileDto {
  @IsOptional()
  @IsIn(["INDIVIDUAL", "COMPANY"])
  customerType?: "INDIVIDUAL" | "COMPANY";

  @IsOptional()
  @IsIn(["CURRENT_OWNER", "FORMER_OWNER", "NEW_TO_FORD"])
  fordRelationship?: "CURRENT_OWNER" | "FORMER_OWNER" | "NEW_TO_FORD";

  @IsString() @MinLength(3) fullName!: string;
  @IsEmail() email!: string;
  @IsOptional() @IsString() phone?: string;

  @IsOptional()
  @IsString()
  @Matches(/^[\d.\-\s]{11,14}$/, { message: "CPF inválido." })
  cpf?: string;

  @IsOptional()
  @IsString()
  @Matches(/^[\d.\/\-\s]{14,18}$/, { message: "CNPJ inválido." })
  cnpj?: string;

  @IsOptional() @IsString() tradeName?: string;
  @IsOptional() @IsString() @Length(0, 30) stateRegistration?: string;
  @IsOptional() @IsBoolean() stateRegistrationExempt?: boolean;
  @IsOptional() @IsString() @Length(0, 40) companyRegistrationStatus?: string;

  @IsOptional() @IsString() legalRepresentativeName?: string;
  @IsOptional() @IsString() @Length(0, 14) legalRepresentativeCpf?: string;
  @IsOptional() @IsString() @Length(0, 30) legalRepresentativeDocument?: string;
  @IsOptional() @IsString() @Length(0, 60) legalRepresentativeRole?: string;
  @IsOptional()
  @IsIn(["SOCIAL_CONTRACT", "BYLAWS", "POWER_OF_ATTORNEY"])
  representationBasis?: "SOCIAL_CONTRACT" | "BYLAWS" | "POWER_OF_ATTORNEY";
  @IsOptional() @IsBoolean() representationDocumentChecked?: boolean;

  @IsOptional() @IsString() @Length(0, 20) rg?: string;
  @IsOptional() @IsString() @Length(0, 20) rgIssuer?: string;
  @IsOptional() @IsDateString() birthDate?: string;

  @IsOptional() @IsString() @Length(0, 10) addressZip?: string;
  @IsOptional() @IsString() addressStreet?: string;
  @IsOptional() @IsString() @Length(0, 10) addressNumber?: string;
  @IsOptional() @IsString() addressComplement?: string;
  @IsOptional() @IsString() addressDistrict?: string;
  @IsOptional() @IsString() addressCity?: string;
  @IsOptional() @IsString() @Length(2, 2) addressState?: string;
}
