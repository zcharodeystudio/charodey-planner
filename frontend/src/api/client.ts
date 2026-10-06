import { deleteItem, getItem, setItem } from '@/lib/storage';

const API_URL = (process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000').replace(/\/$/, '');

export type User = {
  id: string;
  email: string;
  name: string;
};

export type Session = {
  accessToken: string;
  refreshToken: string;
  user: User;
};

export type Task = {
  id: string;
  title: string;
  note: string;
  date: string;
  remindAt: string | null;
  done: boolean;
  createdAt: string;
  updatedAt: string;
};

export type TaskPayload = {
  title: string;
  note?: string;
  date: string;
  remindAt?: string | null;
  done?: boolean;
};

const ACCESS = 'accessToken';
const REFRESH = 'refreshToken';
const USER = 'user';

export class ApiError extends Error {}

export async function saveSession(session: Session) {
  await setItem(ACCESS, session.accessToken);
  await setItem(REFRESH, session.refreshToken);
  await setItem(USER, JSON.stringify(session.user));
}

export async function clearSession() {
  await deleteItem(ACCESS);
  await deleteItem(REFRESH);
  await deleteItem(USER);
}

export async function readStoredUser(): Promise<User | null> {
  const raw = await getItem(USER);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as User;
  } catch {
    return null;
  }
}

let refreshPromise: Promise<string | null> | null = null;

async function refreshAccess() {
  if (!refreshPromise) {
    refreshPromise = (async () => {
      const refreshToken = await getItem(REFRESH);
      if (!refreshToken) return null;
      let response: Response;
      try {
        response = await fetch(`${API_URL}/auth/refresh`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify({ refreshToken }),
        });
      } catch {
        return null;
      }
      if (!response.ok) {
        await clearSession();
        return null;
      }
      const session = (await response.json()) as Session;
      await saveSession(session);
      return session.accessToken;
    })().finally(() => {
      refreshPromise = null;
    });
  }
  return refreshPromise;
}

async function request<T>(path: string, init: RequestInit = {}, retry = true): Promise<T> {
  const headers = new Headers(init.headers);
  headers.set('Accept', 'application/json');
  if (init.body) headers.set('Content-Type', 'application/json');
  const access = await getItem(ACCESS);
  if (access) headers.set('Authorization', `Bearer ${access}`);

  let response: Response;
  try {
    response = await fetch(`${API_URL}${path}`, { ...init, headers });
  } catch {
    throw new ApiError('Нет связи с сервером. Проверьте, что бэкенд запущен.');
  }

  const skipRefresh = path === '/auth/login' || path === '/auth/register' || path === '/auth/refresh';
  if (response.status === 401 && retry && !skipRefresh) {
    const next = await refreshAccess();
    if (next) return request<T>(path, init, false);
  }

  if (!response.ok) {
    throw new ApiError(await readError(response));
  }
  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

async function readError(response: Response) {
  try {
    const body = (await response.json()) as { message?: string | string[] };
    if (Array.isArray(body.message)) return body.message.join('\n');
    if (typeof body.message === 'string') return body.message;
  } catch {
    return 'Не удалось выполнить запрос';
  }
  return 'Не удалось выполнить запрос';
}

export const api = {
  register(body: { name: string; email: string; password: string }) {
    return request<Session>('/auth/register', { method: 'POST', body: JSON.stringify(body) });
  },
  login(body: { email: string; password: string }) {
    return request<Session>('/auth/login', { method: 'POST', body: JSON.stringify(body) });
  },
  async logout() {
    const refreshToken = await getItem(REFRESH);
    if (refreshToken) {
      try {
        await request('/auth/logout', { method: 'POST', body: JSON.stringify({ refreshToken }) });
      } catch {
        // Локальная сессия всё равно сбрасывается.
      }
    }
    await clearSession();
  },
  profile() {
    return request<User>('/auth/profile');
  },
  listTasks(date: string) {
    return request<Task[]>(`/tasks?date=${date}`);
  },
  taskDates(from: string, to: string) {
    return request<{ dates: string[] }>(`/tasks/dates?from=${from}&to=${to}`);
  },
  getTask(id: string) {
    return request<Task>(`/tasks/${id}`);
  },
  createTask(body: TaskPayload) {
    return request<Task>('/tasks', { method: 'POST', body: JSON.stringify(body) });
  },
  updateTask(id: string, body: Partial<TaskPayload>) {
    return request<Task>(`/tasks/${id}`, { method: 'PATCH', body: JSON.stringify(body) });
  },
  deleteTask(id: string) {
    return request<{ ok: boolean }>(`/tasks/${id}`, { method: 'DELETE' });
  },
};
