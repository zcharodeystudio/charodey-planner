import { NOTE_MAX, TITLE_MAX } from '@charodey/validation';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsISO8601, IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';

export class CreateTaskDto {
  @ApiProperty({ example: 'Купить продукты' })
  @IsString()
  @MinLength(1, { message: 'Введите название' })
  @MaxLength(TITLE_MAX, { message: `Название должно быть не длиннее ${TITLE_MAX} символов` })
  title: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(NOTE_MAX, { message: `Заметка должна быть не длиннее ${NOTE_MAX} символов` })
  note?: string;

  @ApiProperty({ example: '2026-10-06' })
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'Дата в формате ГГГГ-ММ-ДД' })
  date: string;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsISO8601({}, { message: 'Некорректное время напоминания' })
  remindAt?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  done?: boolean;
}
