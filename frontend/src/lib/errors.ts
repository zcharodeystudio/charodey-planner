import { ApiError } from '@/api/client';

export function getErrorMessage(error: unknown) {
  if (error instanceof ApiError) return error.message;
  if (error instanceof Error && error.message) return error.message;
  return 'Что-то пошло не так';
}
