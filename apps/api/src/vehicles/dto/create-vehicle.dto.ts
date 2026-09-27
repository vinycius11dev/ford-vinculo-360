import { ApiProperty } from '@nestjs/swagger';
import { VehicleCondition } from '@prisma/client';
import { IsEnum, IsInt, IsOptional, IsString, Length, Matches, Min, MinLength } from 'class-validator';

export class CreateVehicleDto {
  @ApiProperty({ example: '9BFXXXXXXXXXXXXXX' })
  @IsString()
  @Length(17, 17)
  @Matches(/^[A-HJ-NPR-Z0-9]{17}$/i, { message: 'VIN deve conter 17 caracteres válidos.' })
  vin!: string;

  @IsString() @MinLength(1) catalogItemId!: string;
  @IsOptional() @IsString() @MinLength(2) exteriorColor?: string;
  @IsOptional() @IsString() @MinLength(2) interiorColor?: string;

  @ApiProperty({ example: 2024 })
  @IsInt()
  @Min(1900)
  manufactureYear!: number;

  @ApiProperty({ example: 1200, required: false })
  @IsOptional()
  @IsInt()
  @Min(0)
  currentMileage?: number;

  @ApiProperty({ example: 'ABC1D23', required: false })
  @IsOptional()
  @IsString()
  @Length(7, 8)
  plate?: string;

  @IsEnum(VehicleCondition)
  condition!: VehicleCondition;

  @IsOptional() @IsInt() @Min(0)
  listPrice?: number;

  @IsOptional() @IsString()
  stockDealershipId?: string;
}
