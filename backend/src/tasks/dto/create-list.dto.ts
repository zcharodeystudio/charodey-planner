import { IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';

export class CreateListDto {
  @IsString()
  @MinLength(1, { message: 'Введите название' })
  @MaxLength(40)
  name: string;

  @IsString()
  @Matches(/^#[0-9A-Fa-f]{6}$/, { message: 'Некорректный цвет' })
  color: string;
}

export class UpdateListDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(40)
  name?: string;

  @IsOptional()
  @IsString()
  @Matches(/^#[0-9A-Fa-f]{6}$/)
  color?: string;
}
