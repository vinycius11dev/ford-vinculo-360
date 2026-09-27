import { IsOptional, IsString, Length, MaxLength } from "class-validator";

export class ExpressRepurchaseInterestDto {
  @IsString()
  @Length(17, 17)
  vin!: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  desiredModel?: string;
}
