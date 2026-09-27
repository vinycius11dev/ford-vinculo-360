import { IsInt, IsNumber, Min } from 'class-validator';
export class ChurnFeaturesDto {
  @IsInt() @Min(0) daysSinceLastService!: number;
  @IsInt() @Min(0) servicesLast24Months!: number;
  @IsNumber() @Min(0) vehicleAgeYears!: number;
  @IsInt() @Min(0) voucherUsageCount!: number;
}
