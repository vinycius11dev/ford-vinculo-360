import { IsDateString, IsInt, IsOptional, IsString, Min } from 'class-validator';
export class CreateVoucherDto {
  @IsString() userId!: string;
  @IsString() title!: string;
  @IsInt() @Min(0) pointsCost!: number;
  @IsOptional() @IsDateString() expiresAt?: string;
}
