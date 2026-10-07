import { Ionicons } from '@expo/vector-icons';
import { Href, router, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { occursOn } from '@charodey/validation';
import { api, type Task, type TaskListItem } from '@/api/client';
import { SwipeToDelete } from '@/components/swipe-to-delete';
import { TaskCard } from '@/components/task-card';
import { TaskTable } from '@/components/task-table';
import { formatLongDate, rangeBounds, todayISO, type ViewRange } from '@/lib/dates';
import { getErrorMessage } from '@/lib/errors';
import { cancelTaskReminder, syncTaskReminder } from '@/lib/notifications';
import { showToast } from '@/lib/toast';
import { usePlanner, SORTS, type SortMode, type TaskScope } from '@/store/planner-context';
import { useTheme } from '@/store/theme-context';
import { colors, radii, spacing } from '@/theme/theme';

function normalize(task: Task): Task {
  return {
    ...task,
    time: task.time ?? null,
    important: Boolean(task.important),
    isEvent: Boolean(task.isEvent),
    repeat: task.repeat ?? 'none',
    repeatDays: task.repeatDays ?? [],
    steps: task.steps ?? [],
    files: task.files ?? [],
    listId: task.listId ?? null,
    favorite: Boolean(task.favorite),
    position: typeof task.position === 'number' ? task.position : 0,
  };
}

export function TaskList({ date, tools = false }: { date: string; tools?: boolean }) {
  const theme = useTheme();
  const planner = usePlanner();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [lists, setLists] = useState<TaskListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const bounds = tools ? rangeBounds(date, planner.range, planner.rangeFrom, planner.rangeTo) : { from: date, to: date };

  const load = useCallback(
    async (mode: 'initial' | 'refresh' = 'initial') => {
      if (mode === 'refresh') setRefreshing(true);
      else setLoading(true);
      try {
        const today = todayISO();
        const yearAgo = shiftYear(today);
        const timeless = tools && planner.scope === 'untimed';
        const fetchFrom = timeless ? '2000-01-01' : tools && (planner.scope === 'overdue' || planner.sort === 'overdue') && bounds.from > yearAgo ? yearAgo : bounds.from;
        const fetchTo = timeless ? '2100-12-31' : tools && planner.scope === 'overdue' ? today : bounds.to;
        const [nextTasks, nextLists] = await Promise.all([
          tools && planner.scope === 'favorites'
            ? api.favorites()
            : tools
              ? api.taskRange(fetchFrom, fetchTo)
              : api.listTasks(date),
          api.lists().catch(() => [] as TaskListItem[]),
        ]);
        setTasks(nextTasks.map(normalize));
        setLists(nextLists);
        setError(null);
      } catch (err) {
        setError(getErrorMessage(err));
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [bounds.from, bounds.to, date, planner.scope, planner.sort, tools],
  );

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const rows = useMemo(
    () =>
      buildRows(tasks, bounds, {
        sort: planner.sort,
        listId: planner.listId,
        reorder: planner.reorder,
        newOnTop: planner.newOnTop,
        scope: tools ? planner.scope : 'all',
        groupByDate: tools ? planner.layout === 'dates' : false,
        range: tools ? planner.range : 'day',
      }),
    [bounds, planner, tasks, tools],
  );

  const toggle = async (task: Task) => {
    const next = !task.done;
    setTasks((current) => current.map((item) => (item.id === task.id ? { ...item, done: next } : item)));
    try {
      const saved = normalize(await api.updateTask(task.id, { done: next }));
      await syncTaskReminder(saved);
      setTasks((current) => current.map((item) => (item.id === saved.id ? saved : item)));
    } catch (err) {
      setTasks((current) => current.map((item) => (item.id === task.id ? task : item)));
      showToast(getErrorMessage(err));
    }
  };

  const toggleStep = async (task: Task, stepId: string) => {
    const steps = (task.steps ?? []).map((step) => (step.id === stepId ? { ...step, done: !step.done } : step));
    setTasks((current) => current.map((item) => (item.id === task.id ? { ...item, steps } : item)));
    try {
      await api.updateTask(task.id, { steps });
    } catch (err) {
      setTasks((current) => current.map((item) => (item.id === task.id ? task : item)));
      showToast(getErrorMessage(err));
    }
  };

  const toggleImportant = async (task: Task) => {
    const next = !task.important;
    setTasks((current) => current.map((item) => (item.id === task.id ? { ...item, important: next } : item)));
    try {
      await api.updateTask(task.id, { important: next });
    } catch (err) {
      setTasks((current) => current.map((item) => (item.id === task.id ? task : item)));
      showToast(getErrorMessage(err));
    }
  };

  const favorite = async (task: Task) => {
    const next = !task.favorite;
    setTasks((current) =>
      !next && planner.scope === 'favorites'
        ? current.filter((item) => item.id !== task.id)
        : current.map((item) => (item.id === task.id ? { ...item, favorite: next } : item)),
    );
    try {
      await api.updateTask(task.id, { favorite: next });
    } catch (err) {
      setTasks((current) => (current.some((item) => item.id === task.id) ? current.map((item) => (item.id === task.id ? task : item)) : [task, ...current]));
      showToast(getErrorMessage(err));
    }
  };

  const move = async (day: string, taskId: string, direction: -1 | 1) => {
    const siblings = rows.flatMap((row) => (row.kind === 'task' && row.day === day ? [row.task] : []));
    const from = siblings.findIndex((item) => item.id === taskId);
    const to = from + direction;
    if (from < 0 || to < 0 || to >= siblings.length) return;
    const ordered = [...siblings];
    const [item] = ordered.splice(from, 1);
    ordered.splice(to, 0, item);
    const base = Date.now();
    const positioned = ordered.map((task, index) => ({ ...task, position: base + index }));
    setTasks((current) =>
      current.map((task) => {
        const next = positioned.find((entry) => entry.id === task.id);
        return next ? { ...task, position: next.position } : task;
      }),
    );
    try {
      await Promise.all(positioned.map((task) => api.updateTask(task.id, { position: task.position })));
    } catch (err) {
      setTasks((current) =>
        current.map((task) => {
          const previous = siblings.find((entry) => entry.id === task.id);
          return previous ?? task;
        }),
      );
      showToast(getErrorMessage(err));
    }
  };

  const remove = async (task: Task) => {
    setTasks((current) => current.filter((item) => item.id !== task.id));
    try {
      await api.deleteTask(task.id);
      await cancelTaskReminder(task.id);
    } catch (err) {
      setTasks((current) => [task, ...current]);
      showToast(getErrorMessage(err));
    }
  };

  return (
    <View style={styles.wrap}>
      {tools && planner.sort ? (
        <View style={styles.badgeRow}>
          <View style={[styles.badge, { backgroundColor: theme.primaryMuted }]}>
            <Text style={[styles.badgeText, { color: theme.primaryPressed }]}>{SORTS.find((item) => item.id === planner.sort)?.label}</Text>
            <Pressable accessibilityLabel="Сбросить" hitSlop={8} onPress={() => planner.setSort(null)}>
              <Ionicons name="close" size={16} color={theme.primaryPressed} />
            </Pressable>
          </View>
        </View>
      ) : null}
      {loading && tasks.length === 0 ? (
        <ActivityIndicator color={theme.primary} style={styles.loader} />
      ) : (
        <ScrollView
          style={styles.scroller}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void load('refresh')} tintColor={theme.primary} />}
          showsVerticalScrollIndicator={false}
        >
          {error ? <Text style={styles.error}>{error}</Text> : null}
          {rows.length === 0 && !error ? (
            <View style={styles.empty}>
              <Text style={styles.emptyTitle}>Задач нет</Text>
              <Text style={styles.emptyText}>
                {planner.scope === 'untimed'
                  ? 'Нажмите плюс справа внизу, чтобы добавить задачу без времени.'
                  : 'Нажмите плюс справа внизу, чтобы добавить задачу.'}
              </Text>
            </View>
          ) : null}
          {tools && planner.layout === 'table' && rows.length > 0 ? (
            <TaskTable
              rows={rows}
              lists={lists}
              reorder={planner.reorder}
              onOpen={(task) => router.push(`/(app)/task/${task.id}` as Href)}
              onToggle={(task) => void toggle(task)}
              onFavorite={(task) => void favorite(task)}
              onImportant={(task) => void toggleImportant(task)}
              onToggleStep={(task, stepId) => void toggleStep(task, stepId)}
              onMove={(day, id, delta) => void move(day, id, delta)}
              onDelete={(task) => void remove(task)}
            />
          ) : (
            rows.map((row) =>
              row.kind === 'header' ? (
                <Text key={row.key} style={styles.section}>
                  {row.title}
                </Text>
              ) : (
                <SwipeToDelete key={row.key} onDelete={() => void remove(row.task)}>
                  <TaskCard
                    task={row.task}
                    index={row.index}
                    listColor={lists.find((list) => list.id === row.task.listId)?.color}
                    onPress={() => router.push(`/(app)/task/${row.task.id}` as Href)}
                    onToggle={() => void toggle(row.task)}
                    onFavorite={() => void favorite(row.task)}
                    onImportant={() => void toggleImportant(row.task)}
                    onToggleStep={(stepId) => void toggleStep(row.task, stepId)}
                    onMoveUp={planner.reorder && row.canUp ? () => void move(row.day, row.task.id, -1) : undefined}
                    onMoveDown={planner.reorder && row.canDown ? () => void move(row.day, row.task.id, 1) : undefined}
                  />
                </SwipeToDelete>
              ),
            )
          )}
        </ScrollView>
      )}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Создать задачу"
        onPress={() => {
          const list = tools && planner.listId ? `&listId=${planner.listId}` : '';
          router.push(`/(app)/task/new?date=${date}${list}` as Href);
        }}
        style={[styles.fab, { backgroundColor: theme.primary }]}
      >
        <Ionicons name="add" size={32} color={theme.onPrimary} />
      </Pressable>
    </View>
  );
}

type Row =
  | { kind: 'header'; key: string; title: string }
  | { kind: 'task'; key: string; task: Task; index: number; day: string; canUp: boolean; canDown: boolean };

function buildRows(
  tasks: Task[],
  bounds: { from: string; to: string },
  planner: { sort: SortMode; listId: string | null; reorder: boolean; newOnTop: boolean; scope: TaskScope; groupByDate: boolean; range: ViewRange },
): Row[] {
  const today = todayISO();
  let visible = tasks.filter((task) => (planner.listId ? task.listId === planner.listId : true));
  if (planner.scope === 'favorites') visible = visible.filter((task) => task.favorite);
  if (planner.scope === 'untimed') visible = visible.filter((task) => !task.time);

  if (planner.range === 'all' && planner.scope === 'all') return allTaskRows(visible, planner);

  if (planner.scope === 'favorites' || planner.scope === 'overdue' || planner.scope === 'untimed') {
    const source = planner.scope === 'overdue' ? visible.filter((task) => task.repeat === 'none' && task.date < today) : visible;
    if (!planner.groupByDate) return flatRows(sortTasks(source, planner.sort, planner.reorder, planner.newOnTop), 'list');
    return groupedRows(source, planner);
  }

  const overdue = visible.filter((task) => task.repeat === 'none' && task.date < today);
  const rows: Row[] = [];
  let index = 0;
  if (planner.sort === 'overdue' && overdue.length) {
    rows.push({ kind: 'header', key: 'overdue', title: 'Просроченные' });
    index = appendTasks(rows, sortTasks(overdue, 'time', planner.reorder, planner.newOnTop), 'overdue', index);
  }
  const skipped = new Set(planner.sort === 'overdue' ? overdue.map((task) => task.id) : []);
  if (!planner.groupByDate) {
    const seen = new Set<string>();
    const unique: Task[] = [];
    for (let cursor = bounds.from; cursor <= bounds.to; cursor = nextIso(cursor)) {
      for (const task of visible) {
        if (seen.has(task.id) || (skipped.has(task.id) && cursor < today)) continue;
        if (!occursOn(task, cursor)) continue;
        seen.add(task.id);
        unique.push(task);
      }
    }
    appendTasks(rows, sortTasks(unique, planner.sort, planner.reorder, planner.newOnTop), 'list', index);
    return rows;
  }
  const groups = new Map<string, Task[]>();
  for (let cursor = bounds.from; cursor <= bounds.to; cursor = nextIso(cursor)) {
    const dayTasks = visible.filter((task) => occursOn(task, cursor) && !(skipped.has(task.id) && cursor < today));
    if (dayTasks.length) groups.set(cursor, sortTasks(dayTasks, planner.sort, planner.reorder, planner.newOnTop));
  }
  for (const [day, dayTasks] of groups) {
    if (bounds.from !== bounds.to) rows.push({ kind: 'header', key: day, title: formatLongDate(day) });
    index = appendTasks(rows, dayTasks, day, index);
  }
  return rows;
}

function allTaskRows(tasks: Task[], planner: { sort: SortMode; reorder: boolean; newOnTop: boolean; groupByDate: boolean }): Row[] {
  const today = todayISO();
  const overdue = planner.sort === 'overdue' ? tasks.filter((task) => task.repeat === 'none' && task.date < today) : [];
  const rest = overdue.length ? tasks.filter((task) => !overdue.some((item) => item.id === task.id)) : tasks;
  const rows: Row[] = [];
  let index = 0;
  if (overdue.length) {
    rows.push({ kind: 'header', key: 'overdue', title: 'Просроченные' });
    index = appendTasks(rows, sortTasks(overdue, 'time', planner.reorder, planner.newOnTop), 'overdue', index);
  }
  if (!planner.groupByDate) {
    appendTasks(rows, sortTasks(rest, planner.sort, planner.reorder, planner.newOnTop), 'list', index);
    return rows;
  }
  return [...rows, ...groupedRows(rest, planner)];
}

function groupedRows(tasks: Task[], planner: { sort: SortMode; reorder: boolean; newOnTop: boolean }): Row[] {
  const groups = new Map<string, Task[]>();
  for (const task of tasks) {
    const bucket = groups.get(task.date) ?? [];
    bucket.push(task);
    groups.set(task.date, bucket);
  }
  const rows: Row[] = [];
  let index = 0;
  for (const day of [...groups.keys()].sort()) {
    const dayTasks = sortTasks(groups.get(day) ?? [], planner.sort, planner.reorder, planner.newOnTop);
    rows.push({ kind: 'header', key: day, title: formatLongDate(day) });
    index = appendTasks(rows, dayTasks, day, index);
  }
  return rows;
}

function flatRows(tasks: Task[], day: string) {
  const rows: Row[] = [];
  appendTasks(rows, tasks, day, 0);
  return rows;
}

function appendTasks(rows: Row[], tasks: Task[], day: string, index: number) {
  tasks.forEach((task, place) => {
    rows.push({
      kind: 'task',
      key: `${day}-${task.id}`,
      task,
      index: index + place,
      day,
      canUp: place > 0,
      canDown: place < tasks.length - 1,
    });
  });
  return index + tasks.length;
}

function sortTasks(tasks: Task[], sort: SortMode, reorder: boolean, newOnTop: boolean) {
  return [...tasks].sort((a, b) => {
    if (reorder || (newOnTop && sort !== 'important')) return a.position - b.position;
    if (sort === 'important' && a.important !== b.important) return a.important ? -1 : 1;
    if (a.time && b.time) return a.time.localeCompare(b.time);
    if (a.time) return -1;
    if (b.time) return 1;
    return a.title.localeCompare(b.title, 'ru');
  });
}

function nextIso(iso: string) {
  const [year, month, day] = iso.split('-').map(Number);
  const date = new Date(year, month - 1, day + 1);
  const nextMonth = String(date.getMonth() + 1).padStart(2, '0');
  const nextDay = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${nextMonth}-${nextDay}`;
}

function shiftYear(iso: string) {
  const [year, month, day] = iso.split('-');
  return `${Number(year) - 1}-${month}-${day}`;
}

const styles = StyleSheet.create({
  wrap: { flex: 1 },
  badgeRow: { paddingHorizontal: spacing.lg, paddingBottom: spacing.sm },
  badge: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: radii.full,
    paddingLeft: 12,
    paddingRight: 8,
    minHeight: 32,
  },
  badgeText: { fontSize: 13, fontWeight: '700' },
  scroller: { flex: 1 },
  list: { paddingHorizontal: spacing.lg, paddingBottom: 88, gap: spacing.sm },
  loader: { marginTop: spacing.xl },
  empty: { paddingVertical: spacing.xl, gap: spacing.sm },
  emptyTitle: { fontSize: 18, fontWeight: '800', color: colors.text },
  emptyText: { fontSize: 15, lineHeight: 21, color: colors.textSecondary },
  error: { color: colors.error, fontSize: 14 },
  section: { fontSize: 14, fontWeight: '800', color: colors.textSecondary, marginTop: spacing.sm },
  fab: {
    position: 'absolute',
    right: spacing.lg,
    bottom: spacing.md,
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
    elevation: 3,
  },
});
