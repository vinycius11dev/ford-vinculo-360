import { IsEmail, IsString, Length } from 'class-validator';

export class TransferVehicleDto {
  @IsString()
  @Length(17, 17)
  vin!: string;

  @IsEmail()
  newOwnerEmail!: string;
}
