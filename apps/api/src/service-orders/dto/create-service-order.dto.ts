import { IsInt, IsOptional, IsString, Length, Max, Min } from 'class-validator';

export class CreateServiceOrderDto {
  @IsString() @Length(17, 17) vin!: string;
  @IsInt() @Min(0) mileage!: number;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsString() dealershipId?: string;
  @IsOptional() @IsInt() @Min(0) @Max(2000000000) amount?: number;
}
