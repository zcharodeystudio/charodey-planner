import { IsString, Matches } from 'class-validator';

const DAY = /^\d{4}-\d{2}-\d{2}$/;

export class TasksByDateQuery {
  @IsString()
  @Matches(DAY, { message: 'Дата в формате ГГГГ-ММ-ДД' })
  date: string;
}

export class TaskDatesQuery {
  @IsString()
  @Matches(DAY, { message: 'Дата в формате ГГГГ-ММ-ДД' })
  from: string;

  @IsString()
  @Matches(DAY, { message: 'Дата в формате ГГГГ-ММ-ДД' })
  to: string;
}
