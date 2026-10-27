import { z } from 'zod';

export const PASSWORD_MIN = 8;
export const PASSWORD_MAX = 72;
export const NAME_MAX = 60;
export const TITLE_MAX = 120;
export const NOTE_MAX = 1000;

const emailSchema = z
  .string()
  .trim()
  .regex(/^[^\s@]+@[^\s@]+\.[^\s@]+$/, 'Введите корректный email');

export const passwordSchema = z
  .string()
  .min(PASSWORD_MIN, `Пароль должен быть не короче ${PASSWORD_MIN} символов`)
  .max(PASSWORD_MAX, `Пароль должен быть не длиннее ${PASSWORD_MAX} символов`);

export const nameSchema = z
  .string()
  .trim()
  .min(1, 'Введите имя')
  .max(NAME_MAX, `Имя должно быть не длиннее ${NAME_MAX} символов`);

export const dateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Дата в формате ГГГГ-ММ-ДД')
  .refine((value) => {
    const [year, month, day] = value.split('-').map(Number);
    const date = new Date(Date.UTC(year, month - 1, day));
    return (
      date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
    );
  }, 'Некорректная дата');

export const registerSchema = z.object({
  name: nameSchema,
  email: emailSchema,
  password: passwordSchema,
});

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Введите пароль'),
});

export const REPEAT_MODES = ['none', 'daily', 'workdays', 'weekdays', 'weekly', 'monthly', 'yearly', 'custom'] as const;
export type RepeatMode = (typeof REPEAT_MODES)[number];
export const REPEAT_UNITS = ['day', 'week', 'month', 'year'] as const;
export type RepeatUnit = (typeof REPEAT_UNITS)[number];

export const taskStepSchema = z.object({
  id: z.string().min(1).max(40),
  title: z.string().trim().min(1).max(120),
  done: z.boolean(),
});

export const taskFileSchema = z.object({
  name: z.string().trim().min(1).max(180),
  mimeType: z.string().trim().min(1).max(120),
  data: z.string().max(1_200_000),
});

const timeSchema = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Время в формате ЧЧ:ММ');

export const taskInputSchema = z.object({
  title: z.string().trim().min(1, 'Введите название').max(TITLE_MAX),
  note: z.string().trim().max(NOTE_MAX).optional().default(''),
  date: z.union([dateSchema, z.null()]),
  time: z.union([timeSchema, z.null()]).optional(),
  remindAt: z.union([z.iso.datetime(), z.null()]).optional(),
  done: z.boolean().optional(),
  important: z.boolean().optional(),
  isEvent: z.boolean().optional(),
  favorite: z.boolean().optional(),
  position: z.number().int().optional(),
  repeat: z.enum(REPEAT_MODES).optional(),
  repeatDays: z.array(z.number().int().min(0).max(31)).max(31).optional(),
  repeatEvery: z.number().int().min(1).max(99).optional(),
  repeatUnit: z.enum(REPEAT_UNITS).optional(),
  steps: z.array(taskStepSchema).max(20).optional(),
  files: z.array(taskFileSchema).max(3).optional(),
  listId: z.union([z.string().min(1), z.null()]).optional(),
  dueDate: z.union([dateSchema, z.null()]).optional(),
  boardId: z.union([z.string().min(1), z.null()]).optional(),
  statusId: z.union([z.string().min(1).max(40), z.null()]).optional(),
});

export function weekdayIndex(iso: string) {
  const [year, month, day] = iso.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return (date.getUTCDay() + 6) % 7;
}

export function occursOn(task: { date?: string | null }, iso: string) {
  return Boolean(task.date) && task.date === iso;
}

function pad(value: number) {
  return String(value).padStart(2, '0');
}

function addDays(iso: string, days: number) {
  const [year, month, day] = iso.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day + days));
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`;
}

function addMonths(iso: string, count: number) {
  const [year, month, day] = iso.split('-').map(Number);
  const total = month - 1 + count;
  const nextYear = year + Math.floor(total / 12);
  const nextMonth = ((total % 12) + 12) % 12;
  const last = new Date(Date.UTC(nextYear, nextMonth + 1, 0)).getUTCDate();
  return `${nextYear}-${pad(nextMonth + 1)}-${pad(Math.min(day, last))}`;
}

export function nextRepeatDate(date: string, repeat: string, repeatDays: number[] = [], every = 1, unit: RepeatUnit = 'week') {
  if (!date || !repeat || repeat === 'none') return null;
  const step = Math.min(99, Math.max(1, every || 1));
  if (repeat === 'daily') return addDays(date, 1);
  if (repeat === 'weekly') return addDays(date, 7);
  if (repeat === 'workdays' || repeat === 'weekdays') {
    let cursor = addDays(date, 1);
    for (let index = 0; index < 7; index += 1) {
      if (weekdayIndex(cursor) <= 4) return cursor;
      cursor = addDays(cursor, 1);
    }
    return null;
  }
  if (repeat === 'yearly') return addMonths(date, 12);
  if (repeat === 'monthly') {
    const day = Number(date.slice(8));
    const wanted = repeatDays.find((value) => value >= 1 && value <= 31) ?? day;
    const shifted = addMonths(date, 1);
    const [year, month] = shifted.split('-').map(Number);
    const last = new Date(Date.UTC(year, month, 0)).getUTCDate();
    return `${year}-${pad(month)}-${pad(Math.min(wanted, last))}`;
  }
  if (repeat === 'custom') {
    if (unit === 'day') return addDays(date, step);
    if (unit === 'year') return addMonths(date, step * 12);
    if (unit === 'month') {
      const days = [...new Set(repeatDays.filter((value) => value >= 0 && value <= 6))].sort((left, right) => left - right);
      if (!days.length) return addMonths(date, step);
      const current = weekdayIndex(date);
      const later = days.find((value) => value > current);
      if (later !== undefined) return addDays(date, later - current);
      let cursor = addMonths(date, step);
      for (let index = 0; index < 7; index += 1) {
        if (days.includes(weekdayIndex(cursor))) return cursor;
        cursor = addDays(cursor, 1);
      }
      return cursor;
    }
    const days = [...new Set(repeatDays.filter((value) => value >= 0 && value <= 6))].sort((left, right) => left - right);
    if (!days.length) return null;
    const current = weekdayIndex(date);
    const later = days.find((value) => value > current);
    if (later !== undefined) return addDays(date, later - current);
    return addDays(date, 7 - current + (step - 1) * 7 + days[0]);
  }
  return null;
}

export const taskUpdateSchema = taskInputSchema.partial();

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type TaskInput = z.infer<typeof taskInputSchema>;
export type TaskUpdateInput = z.infer<typeof taskUpdateSchema>;
