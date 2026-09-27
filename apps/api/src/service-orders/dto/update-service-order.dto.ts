import { ServiceOrderStatus } from '@prisma/client';
import { IsEnum, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class UpdateServiceOrderDto {
  @IsOptional() @IsEnum(ServiceOrderStatus) status?: ServiceOrderStatus;
  @IsOptional() @IsInt() @Min(0) mileage?: number;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsInt() @Min(0) @Max(100000) points?: number;
  @IsOptional() @IsInt() @Min(0) @Max(2000000000) amount?: number;
}
