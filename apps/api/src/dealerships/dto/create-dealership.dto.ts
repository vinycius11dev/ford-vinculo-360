import { IsString, Length, MinLength } from "class-validator";

export class CreateDealershipDto {
  @IsString() @MinLength(3) legalName!: string;
  @IsString() @MinLength(2) tradeName!: string;
  @IsString() @Length(14, 14) cnpj!: string;
  @IsString() @MinLength(2) city!: string;
  @IsString() @Length(2, 2) state!: string;
}
