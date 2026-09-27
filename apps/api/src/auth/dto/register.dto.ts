import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsOptional, IsString, Matches, MinLength } from 'class-validator';

export class RegisterDto {
  @ApiProperty({ example: 'cliente@email.com' })
  @IsEmail()
  email!: string;

  @ApiProperty({ example: 'Cliente Ford' })
  @IsString()
  @MinLength(3)
  fullName!: string;

  @ApiProperty({ example: 'Senha@123' })
  @IsString()
  @MinLength(8)
  @Matches(/^(?=.*[A-Z])(?=.*[a-z])(?=.*\d).+$/, { message: 'A senha deve conter letras maiúsculas, minúsculas e números.' })
  password!: string;

  @ApiProperty({ example: '11999999999', required: false })
  @IsOptional()
  @IsString()
  phone?: string;
}
