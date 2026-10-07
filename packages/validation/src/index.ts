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

export const REPEAT_MODES = ['none', 'daily', 'workdays', 'weekdays', 'weekly', 'yearly', 'custom'] as const;
export type RepeatMode = (typeof REPEAT_MODES)[number];

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
  date: dateSchema,
  time: z.union([timeSchema, z.null()]).optional(),
  remindAt: z.union([z.iso.datetime(), z.null()]).optional(),
  done: z.boolean().optional(),
  important: z.boolean().optional(),
  isEvent: z.boolean().optional(),
  favorite: z.boolean().optional(),
  position: z.number().int().optional(),
  repeat: z.enum(REPEAT_MODES).optional(),
  repeatDays: z.array(z.number().int().min(0).max(6)).max(7).optional(),
  steps: z.array(taskStepSchema).max(20).optional(),
  files: z.array(taskFileSchema).max(3).optional(),
  listId: z.union([z.string().min(1), z.null()]).optional(),
});

export function weekdayIndex(iso: string) {
  const [year, month, day] = iso.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return (date.getUTCDay() + 6) % 7;
}

export function occursOn(
  task: { date: string; repeat?: string | null; repeatDays?: number[] | null },
  iso: string,
) {
  if (iso < task.date) return false;
  const repeat = task.repeat || 'none';
  if (repeat === 'none') return task.date === iso;
  if (repeat === 'daily') return true;
  const index = weekdayIndex(iso);
  if (repeat === 'workdays' || repeat === 'weekdays') return index <= 4;
  if (repeat === 'weekly') return index === weekdayIndex(task.date);
  if (repeat === 'yearly') return iso.slice(5) === task.date.slice(5);
  if (repeat === 'custom') return (task.repeatDays ?? []).includes(index);
  return task.date === iso;
}

export const taskUpdateSchema = taskInputSchema.partial();

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type TaskInput = z.infer<typeof taskInputSchema>;
export type TaskUpdateInput = z.infer<typeof taskUpdateSchema>;
