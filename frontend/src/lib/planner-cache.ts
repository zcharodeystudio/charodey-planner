import type { NoteItem, Task, TaskListItem } from '@/api/client';
import { peekJson, readJson, writeJson } from '@/lib/kv';

const listeners = new Set<() => void>();
let activeView: { userId: string; view: string } | null = null;

export function subscribePlannerCache(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function emit() {
  listeners.forEach((listener) => listener());
}

export function setActiveTaskView(userId: string, view: string) {
  activeView = { userId, view };
}

export function visibleTask(task: Task) {
  return {
    id: task.id,
    title: task.title,
    note: task.note,
    done: task.done,
    date: task.date,
    time: task.time ?? null,
    dueDate: task.dueDate ?? null,
    remindAt: task.remindAt,
    important: Boolean(task.important),
    favorite: Boolean(task.favorite),
    isEvent: Boolean(task.isEvent),
    position: task.position ?? 0,
    repeat: task.repeat ?? 'none',
    repeatDays: task.repeatDays ?? [],
    repeatEvery: task.repeatEvery || 1,
    repeatUnit: task.repeatUnit ?? 'week',
    listId: task.listId ?? null,
    steps: (task.steps ?? []).map((step) => ({ id: step.id, title: step.title, done: step.done })),
  };
}

export function sameTasks(left: Task[], right: Task[]) {
  return JSON.stringify(left.map(visibleTask)) === JSON.stringify(right.map(visibleTask));
}

export function sameLists(left: TaskListItem[], right: TaskListItem[]) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function key(userId: string, name: string) {
  return `charodey.${userId}.${name}`;
}

export function tasksCacheKey(userId: string, view: string) {
  return key(userId, `tasks.${view}`);
}

export function peekTasksCache(userId: string, view: string) {
  return peekJson<{ tasks: Task[]; lists: TaskListItem[] }>(tasksCacheKey(userId, view));
}

export function readTasksCache(userId: string, view: string) {
  return readJson<{ tasks: Task[]; lists: TaskListItem[] }>(tasksCacheKey(userId, view));
}

export function writeTasksCache(userId: string, view: string, tasks: Task[], lists: TaskListItem[]) {
  const light = tasks.map((task) => ({
    ...task,
    files: (task.files ?? []).map((file) => ({ name: file.name, mimeType: file.mimeType, data: file.data.length > 80_000 ? '' : file.data })),
  }));
  return writeJson(tasksCacheKey(userId, view), { tasks: light, lists });
}

export function adoptSavedTask(task: Task) {
  if (!activeView) return;
  const snap = peekTasksCache(activeView.userId, activeView.view) ?? { tasks: [], lists: [] };
  const tasks = snap.tasks.some((item) => item.id === task.id)
    ? snap.tasks.map((item) => (item.id === task.id ? { ...item, ...task } : item))
    : [...snap.tasks, task];
  void writeTasksCache(activeView.userId, activeView.view, tasks, snap.lists).finally(emit);
}

export function peekListsCache(userId: string) {
  return peekJson<TaskListItem[]>(key(userId, 'lists'));
}

export function readListsCache(userId: string) {
  return readJson<TaskListItem[]>(key(userId, 'lists'));
}

export function writeListsCache(userId: string, lists: TaskListItem[]) {
  return writeJson(key(userId, 'lists'), lists);
}

export function peekNotesCache(userId: string) {
  return peekJson<NoteItem[]>(key(userId, 'notes'));
}

export function readNotesCache(userId: string) {
  return readJson<NoteItem[]>(key(userId, 'notes'));
}

export function writeNotesCache(userId: string, notes: NoteItem[]) {
  return writeJson(key(userId, 'notes'), notes);
}
