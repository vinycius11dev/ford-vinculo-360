import { IsIn, IsString, MaxLength, MinLength } from "class-validator";

/** Decisão humana obrigatória antes de ativar uma posse informada pelo app. */
export class ResolveVehicleValidationDto {
  @IsIn(["APPROVE", "REJECT"])
  decision!: "APPROVE" | "REJECT";

  @IsString()
  @MinLength(8)
  @MaxLength(5000)
  resolution!: string;
}
