import { IsDateString, IsOptional, IsString, Length } from 'class-validator';

export class CreateBookingDto {
  @IsString() @Length(17, 17) vin!: string;
  @IsString() dealershipId!: string;
  @IsDateString() requestedFor!: string;
  @IsOptional() @IsString() notes?: string;
  @IsOptional() @IsString() userId?: string;
}
