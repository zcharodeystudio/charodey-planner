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

export const taskInputSchema = z.object({
  title: z.string().trim().min(1, 'Введите название').max(TITLE_MAX),
  note: z.string().trim().max(NOTE_MAX).optional().default(''),
  date: dateSchema,
  remindAt: z.union([z.iso.datetime(), z.null()]).optional(),
  done: z.boolean().optional(),
});

export const taskUpdateSchema = taskInputSchema.partial();

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type TaskInput = z.infer<typeof taskInputSchema>;
export type TaskUpdateInput = z.infer<typeof taskUpdateSchema>;
