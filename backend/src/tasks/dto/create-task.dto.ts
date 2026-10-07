import { NOTE_MAX, TITLE_MAX } from '@charodey/validation';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsISO8601,
  IsMongoId,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateIf,
  ValidateNested,
} from 'class-validator';

const REPEATS = ['none', 'daily', 'workdays', 'weekdays', 'weekly', 'yearly', 'custom'];

export class TaskStepDto {
  @IsString()
  @MaxLength(40)
  id: string;

  @IsString()
  @MinLength(1)
  @MaxLength(120)
  title: string;

  @IsBoolean()
  done: boolean;
}

export class TaskFileDto {
  @IsString()
  @MaxLength(180)
  name: string;

  @IsString()
  @MaxLength(120)
  mimeType: string;

  @IsString()
  @MaxLength(1_200_000)
  data: string;
}

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
  @ValidateIf((_, value) => value !== null)
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/, { message: 'Время в формате ЧЧ:ММ' })
  time?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsISO8601({}, { message: 'Некорректное время напоминания' })
  remindAt?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  done?: boolean;

  @IsOptional()
  @IsBoolean()
  important?: boolean;

  @IsOptional()
  @IsBoolean()
  isEvent?: boolean;

  @IsOptional()
  @IsBoolean()
  favorite?: boolean;

  @IsOptional()
  @IsInt()
  position?: number;

  @IsOptional()
  @IsIn(REPEATS)
  repeat?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(7)
  @IsInt({ each: true })
  @Min(0, { each: true })
  @Max(6, { each: true })
  repeatDays?: number[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => TaskStepDto)
  steps?: TaskStepDto[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(3)
  @ValidateNested({ each: true })
  @Type(() => TaskFileDto)
  files?: TaskFileDto[];

  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsMongoId()
  listId?: string | null;
}
