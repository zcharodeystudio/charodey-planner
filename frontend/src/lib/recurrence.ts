import { nextRepeatDate } from '@charodey/validation';
import { api, type Task } from '@/api/client';
import { remindAtFromParts } from '@/lib/dates';
import { syncTaskReminder } from '@/lib/notifications';

function remindOn(task: Task, date: string) {
  if (task.time) {
    const [hour, minute] = task.time.split(':').map(Number);
    return remindAtFromParts(date, hour, minute);
  }
  if (!task.remindAt) return null;
  const when = new Date(task.remindAt);
  return remindAtFromParts(date, when.getHours(), when.getMinutes());
}

export async function completeTask(task: Task) {
  const repeat = task.repeat && task.repeat !== 'none' ? task.repeat : null;
  const nextDate = repeat && task.date ? nextRepeatDate(task.date, repeat, task.repeatDays ?? [], task.repeatEvery ?? 1, task.repeatUnit ?? 'week') : null;
  const source = nextDate && task.files?.length ? await api.getTask(task.id) : task;
  const spawned = nextDate && repeat
    ? await api.createTask({
        title: source.title,
        note: source.note,
        date: nextDate,
        time: source.time,
        remindAt: source.remindAt ? remindOn(source, nextDate) : null,
        important: source.important,
        isEvent: source.isEvent,
        favorite: source.favorite,
        repeat,
        repeatDays: source.repeatDays,
        repeatEvery: source.repeatEvery,
        repeatUnit: source.repeatUnit,
        steps: (source.steps ?? []).map((step, index) => ({ ...step, id: `${Date.now()}-${index}`, done: false })),
        files: source.files?.filter((file) => file.data),
        listId: source.listId,
        dueDate: source.dueDate,
        boardId: source.boardId,
        statusId: source.statusId,
        position: source.position,
      })
    : null;
  try {
    const done = await api.updateTask(task.id, {
      done: true,
      ...(nextDate ? { repeat: 'none' as const, repeatDays: [] } : {}),
    });
    await syncTaskReminder(done);
    if (spawned) await syncTaskReminder(spawned);
    return { done, spawned };
  } catch (error) {
    if (spawned) await api.deleteTask(spawned.id).catch(() => undefined);
    throw error;
  }
}

export async function skipOccurrence(task: Task) {
  if (task.done || !task.date || !task.repeat || task.repeat === 'none') return null;
  const nextDate = nextRepeatDate(task.date, task.repeat, task.repeatDays ?? [], task.repeatEvery ?? 1, task.repeatUnit ?? 'week');
  if (!nextDate) return null;
  const saved = await api.updateTask(task.id, {
    date: nextDate,
    remindAt: task.remindAt ? remindOn(task, nextDate) : task.remindAt,
  });
  await syncTaskReminder(saved);
  return saved;
}
