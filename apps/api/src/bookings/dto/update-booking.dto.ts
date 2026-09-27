import { BookingStatus } from '@prisma/client';
import { IsDateString, IsEnum, IsOptional, IsString } from 'class-validator';

export class UpdateBookingDto {
  @IsOptional() @IsEnum(BookingStatus) status?: BookingStatus;
  @IsOptional() @IsDateString() requestedFor?: string;
  @IsOptional() @IsString() notes?: string;
}
