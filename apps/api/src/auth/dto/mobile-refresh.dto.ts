import { IsHexadecimal, IsString, Length } from 'class-validator';

export class MobileRefreshDto {
  @IsString()
  @IsHexadecimal()
  @Length(96, 96)
  refreshToken!: string;
}
