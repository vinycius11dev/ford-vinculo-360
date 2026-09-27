import { AiRecommendationDecision } from '@prisma/client';
import { IsEnum, IsNotEmpty, IsOptional, IsString, MaxLength, ValidateIf } from 'class-validator';

export class ReviewRecommendationDto {
  @IsEnum(AiRecommendationDecision)
  decision!: AiRecommendationDecision;

  @ValidateIf((value: ReviewRecommendationDto) => value.decision === AiRecommendationDecision.DISMISSED)
  @IsString()
  @IsNotEmpty()
  @MaxLength(1000)
  reason?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;
}
