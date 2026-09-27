import { IsInt, IsOptional, IsString, Length, Min } from "class-validator";

export class CreateRepurchaseLeadDto {
  @IsString()
  @Length(17, 17)
  vin!: string;

  @IsInt()
  @Min(0)
  score!: number;

  @IsInt()
  @Min(0)
  estimatedValue!: number;

  @IsOptional()
  @IsString()
  dealershipId?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}
