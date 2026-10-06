import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, MinLength } from 'class-validator';

export class LoginDto {
  @ApiProperty({ example: 'you@example.com' })
  @IsEmail({}, { message: 'Введите корректный email' })
  email: string;

  @ApiProperty()
  @IsString()
  @MinLength(1, { message: 'Введите пароль' })
  password: string;
}
