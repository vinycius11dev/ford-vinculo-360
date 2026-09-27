import {
  IsArray,
  IsDateString,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';
export class CreateCampaignDto {
  @IsString() @MaxLength(160) name!: string;
  @IsString() @MaxLength(2000) description!: string;
  @IsOptional() @IsString() @MaxLength(160) publicTitle?: string;
  @IsOptional() @IsString() @MaxLength(2000) publicDescription?: string;
  @IsOptional() @IsString() @MaxLength(80) publicCtaLabel?: string;
  @IsOptional()
  @IsString()
  @MaxLength(255)
  @Matches(/^\/[a-z0-9/_-]*$/i, {
    message: 'O link público deve ser uma rota interna do aplicativo.',
  })
  publicCtaLink?: string;
  @IsDateString() startsAt!: string;
  @IsDateString() endsAt!: string;
  @IsOptional() @IsArray() @IsString({ each: true }) vehicleVins?: string[];
  /// VINs incluídos a partir de uma recomendação da IA. Estes exigem revisão
  /// humana aprovada antes de a campanha poder ser criada.
  @IsOptional() @IsArray() @IsString({ each: true }) recommendationVins?: string[];
  @IsOptional() @IsString() @MaxLength(100) recommendationModelVersion?: string;
}
