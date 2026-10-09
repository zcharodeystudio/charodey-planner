import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { deleteItem, getItem, setItem } from '@/lib/storage';

function resolveApiUrl() {
  const configured = (process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000').replace(/\/$/, '');
  let url: URL;
  try {
    url = new URL(configured);
  } catch {
    return configured;
  }
  if (url.hostname !== 'localhost' && url.hostname !== '127.0.0.1') return configured;
  if (Platform.OS === 'web') return configured;

  const android = Platform.constants as { Fingerprint?: string; Model?: string };
  const looksLikeEmulator = /generic|emulator|sdk_gphone/i.test(`${android.Fingerprint ?? ''} ${android.Model ?? ''}`);
  if (Platform.OS === 'android' && looksLikeEmulator) {
    url.hostname = '10.0.2.2';
    return url.toString().replace(/\/$/, '');
  }

  const packagerHost = Constants.expoConfig?.hostUri?.split(':')[0];
  if (packagerHost && packagerHost !== 'localhost' && packagerHost !== '127.0.0.1') {
    url.hostname = packagerHost;
    return url.toString().replace(/\/$/, '');
  }
  if (Platform.OS === 'android') {
    url.hostname = '10.0.2.2';
    return url.toString().replace(/\/$/, '');
  }
  return configured;
}

const API_URL = resolveApiUrl();

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

export type TaskStep = { id: string; title: string; done: boolean };
export type TaskFile = { name: string; mimeType: string; data: string };
export type RepeatMode = 'none' | 'daily' | 'workdays' | 'weekdays' | 'weekly' | 'yearly' | 'custom';

export type Task = {
  id: string;
  title: string;
  note: string;
  date: string | null;
  time: string | null;
  remindAt: string | null;
  done: boolean;
  important: boolean;
  isEvent: boolean;
  favorite: boolean;
  position: number;
  repeat: RepeatMode;
  repeatDays: number[];
  steps: TaskStep[];
  files: TaskFile[];
  listId: string | null;
  dueDate: string | null;
  boardId: string | null;
  statusId: string | null;
  createdAt: string;
  updatedAt: string;
};

export type TaskListItem = { id: string; name: string; color: string };

export type TaskPayload = {
  title?: string;
  note?: string;
  date?: string | null;
  time?: string | null;
  remindAt?: string | null;
  done?: boolean;
  important?: boolean;
  isEvent?: boolean;
  favorite?: boolean;
  position?: number;
  repeat?: RepeatMode;
  repeatDays?: number[];
  steps?: TaskStep[];
  files?: TaskFile[];
  listId?: string | null;
  dueDate?: string | null;
  boardId?: string | null;
  statusId?: string | null;
};

export type ProjectBlockType = 'heading' | 'text' | 'bullet' | 'number' | 'todo' | 'divider' | 'table' | 'board' | 'page';
export type ProjectBlockItem = { id: string; text: string; done?: boolean };
export type ProjectPageLink = { id: string; title: string };
export type ProjectBlock = {
  id: string;
  type: ProjectBlockType;
  text: string;
  items: ProjectBlockItem[];
  columns: string[];
  rows: string[][];
  boardId: string | null;
  pageId: string | null;
};
export type ProjectItem = { id: string; name: string; color: string; boards?: BoardItem[] };
export type BoardColumn = { id: string; name: string };
export type BoardItem = { id: string; projectId: string; name: string; columns: BoardColumn[] };
export type NoteItem = {
  id: string;
  title: string;
  body: string;
  color: string;
  pinned: boolean;
  updatedAt: string;
};
export type NotePayload = {
  title?: string;
  body?: string;
  color?: string;
  pinned?: boolean;
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
  taskRange(from: string, to: string) {
    return request<Task[]>(`/tasks/range?from=${from}&to=${to}`);
  },
  favorites() {
    return request<Task[]>('/tasks/favorites');
  },
  undated() {
    return request<Task[]>('/tasks/undated');
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
  updateTask(id: string, body: TaskPayload) {
    return request<Task>(`/tasks/${id}`, { method: 'PATCH', body: JSON.stringify(body) });
  },
  deleteTask(id: string) {
    return request<{ ok: boolean }>(`/tasks/${id}`, { method: 'DELETE' });
  },
  lists() {
    return request<TaskListItem[]>('/lists');
  },
  createList(body: { name: string; color: string }) {
    return request<TaskListItem>('/lists', { method: 'POST', body: JSON.stringify(body) });
  },
  deleteList(id: string) {
    return request<{ ok: boolean }>(`/lists/${id}`, { method: 'DELETE' });
  },
  projects() {
    return request<ProjectItem[]>('/projects');
  },
  createProject(body: { name: string; color: string }) {
    return request<ProjectItem>('/projects', { method: 'POST', body: JSON.stringify(body) });
  },
  deleteProject(id: string) {
    return request<{ ok: boolean }>(`/projects/${id}`, { method: 'DELETE' });
  },
  project(id: string) {
    return request<{ project: ProjectItem; boards: BoardItem[]; blocks: ProjectBlock[]; pages: ProjectPageLink[] }>(`/projects/${id}`);
  },
  projectPage(projectId: string, pageId: string) {
    return request<{ project: ProjectItem; page: ProjectPageLink; boards: BoardItem[]; blocks: ProjectBlock[]; pages: ProjectPageLink[] }>(
      `/projects/${projectId}/pages/${pageId}`,
    );
  },
  updatePage(projectId: string, pageId: string, title: string) {
    return request<ProjectPageLink>(`/projects/${projectId}/pages/${pageId}`, { method: 'PATCH', body: JSON.stringify({ title }) });
  },
  deletePage(projectId: string, pageId: string) {
    return request<{ ok: boolean }>(`/projects/${projectId}/pages/${pageId}`, { method: 'DELETE' });
  },
  addBlock(projectId: string, type: ProjectBlockType, options?: { name?: string; parentPageId?: string; targetPageId?: string }) {
    return request<{ block: ProjectBlock; board?: BoardItem; page?: ProjectPageLink }>(`/projects/${projectId}/blocks`, {
      method: 'POST',
      body: JSON.stringify({ type, name: options?.name, parentPageId: options?.parentPageId, targetPageId: options?.targetPageId }),
    });
  },
  updateBlock(projectId: string, blockId: string, body: Partial<Pick<ProjectBlock, 'text' | 'items' | 'columns' | 'rows'>>, parentPageId?: string) {
    const parent = parentPageId ? `?parent=${encodeURIComponent(parentPageId)}` : '';
    return request<ProjectBlock>(`/projects/${projectId}/blocks/${blockId}${parent}`, { method: 'PATCH', body: JSON.stringify(body) });
  },
  deleteBlock(projectId: string, blockId: string, parentPageId?: string) {
    const parent = parentPageId ? `?parent=${encodeURIComponent(parentPageId)}` : '';
    return request<{ ok: boolean }>(`/projects/${projectId}/blocks/${blockId}${parent}`, { method: 'DELETE' });
  },
  createBoard(projectId: string, name: string) {
    return request<BoardItem>(`/projects/${projectId}/boards`, { method: 'POST', body: JSON.stringify({ name }) });
  },
  board(id: string) {
    return request<{ board: BoardItem; tasks: Task[] }>(`/boards/${id}`);
  },
  addBoardColumn(id: string, name: string) {
    return request<BoardItem>(`/boards/${id}/columns`, { method: 'POST', body: JSON.stringify({ name }) });
  },
  deleteBoard(id: string) {
    return request<{ ok: boolean }>(`/boards/${id}`, { method: 'DELETE' });
  },
  notes() {
    return request<NoteItem[]>('/notes');
  },
  getNote(id: string) {
    return request<NoteItem>(`/notes/${id}`);
  },
  createNote(body: NotePayload = {}) {
    return request<NoteItem>('/notes', { method: 'POST', body: JSON.stringify(body) });
  },
  updateNote(id: string, body: NotePayload) {
    return request<NoteItem>(`/notes/${id}`, { method: 'PATCH', body: JSON.stringify(body) });
  },
  deleteNote(id: string) {
    return request<{ ok: boolean }>(`/notes/${id}`, { method: 'DELETE' });
  },
};
