import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, MinLength } from 'class-validator';

export class LoginDto {
  @ApiProperty({ example: 'gerente@ford360.local' })
  @IsEmail()
  email!: string;

  @ApiProperty({ example: 'Ford@360' })
  @IsString()
  @MinLength(8)
  password!: string;
}
