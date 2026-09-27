import { RecallSeverity } from "@prisma/client";
import {
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsEnum,
  IsString,
  MinLength,
} from "class-validator";

export class CreateRecallDto {
  @IsString() @MinLength(3) code!: string;
  @IsString() @MinLength(3) title!: string;
  @IsString() @MinLength(10) description!: string;
  @IsEnum(RecallSeverity) severity!: RecallSeverity;
  @IsDateString() startsAt!: string;
  @IsArray() @ArrayMinSize(1) @IsString({ each: true }) vehicleVins!: string[];
}
