import { NAME_MAX, PASSWORD_MAX, PASSWORD_MIN } from '@charodey/validation';
import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, MaxLength, MinLength } from 'class-validator';

export class RegisterDto {
  @ApiProperty({ example: 'Карина' })
  @IsString({ message: 'Введите имя' })
  @MinLength(1, { message: 'Введите имя' })
  @MaxLength(NAME_MAX, { message: `Имя должно быть не длиннее ${NAME_MAX} символов` })
  name: string;

  @ApiProperty({ example: 'you@example.com' })
  @IsEmail({}, { message: 'Введите корректный email' })
  email: string;

  @ApiProperty({ example: 'password123' })
  @IsString()
  @MinLength(PASSWORD_MIN, { message: `Пароль должен быть не короче ${PASSWORD_MIN} символов` })
  @MaxLength(PASSWORD_MAX, { message: `Пароль должен быть не длиннее ${PASSWORD_MAX} символов` })
  password: string;
}
