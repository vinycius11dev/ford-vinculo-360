import { Transform } from 'class-transformer';
import { IsString, Matches } from 'class-validator';

export class ClaimVehicleDto {
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim().toUpperCase() : value,
  )
  @IsString()
  @Matches(/^[A-HJ-NPR-Z0-9]{17}$/, {
    message: 'VIN deve conter 17 caracteres válidos.',
  })
  vin!: string;

  @Transform(({ value }) =>
    typeof value === 'string'
      ? value.replace(/[\s-]/g, '').toUpperCase()
      : value,
  )
  @IsString()
  @Matches(/^[A-Z]{3}[0-9][A-Z0-9][0-9]{2}$/, {
    message: 'Informe uma placa brasileira válida.',
  })
  plate!: string;
}
