import { Ionicons } from '@expo/vector-icons';
import { Href, router, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, StyleSheet, Text, TextInput, View } from 'react-native';
import { ScrollView } from 'react-native-gesture-handler';
import { occursOn } from '@charodey/validation';
import { api, type ProjectItem, type Task, type TaskListItem } from '@/api/client';
import { SwipeToDelete } from '@/components/swipe-to-delete';
import { TaskCard } from '@/components/task-card';
import { formatLongDate, isOverdue, rangeBounds, todayISO, type ViewRange } from '@/lib/dates';
import { getErrorMessage } from '@/lib/errors';
import { cancelTaskReminder, syncTaskReminder } from '@/lib/notifications';
import { showToast } from '@/lib/toast';
import { usePlanner, SORTS, type SortMode, type TaskScope } from '@/store/planner-context';
import { useTheme } from '@/store/theme-context';
import { colors, radii, spacing } from '@/theme/theme';

function projectOf(projects: ProjectItem[], boardId: string | null) {
  if (!boardId) return null;
  return projects.find((project) => project.boards?.some((board) => board.id === boardId)) ?? null;
}

function taskBadges(task: Task, lists: TaskListItem[], projects: ProjectItem[], showList: boolean) {
  const list = lists.find((item) => item.id === task.listId);
  const project = projectOf(projects, task.boardId);
  return {
    listColor: list?.color,
    listName: showList ? list?.name : undefined,
    projectColor: project?.color,
    projectName: project?.name,
  };
}

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
  const [projects, setProjects] = useState<ProjectItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [quick, setQuick] = useState(false);
  const [draft, setDraft] = useState('');
  const [savingQuick, setSavingQuick] = useState(false);
  const savingQuickRef = useRef(false);
  const [drag, setDrag] = useState<{ task: Task; day: string; y: number; hoverKey: string | null } | null>(null);
  const dragRef = useRef(drag);
  dragRef.current = drag;
  const suppressPress = useRef(false);
  const slots = useRef<Record<string, { y: number; height: number; day: string; taskId: string | null }>>({});
  const scrollY = useRef(0);
  const listFrame = useRef({ y: 0, height: 0 });
  const scrollRef = useRef<ScrollView>(null);
  const scrollHostRef = useRef<View>(null);
  const wrapRef = useRef<View>(null);
  const wrapTop = useRef(0);

  const bounds = tools ? rangeBounds(date, planner.range, planner.rangeFrom, planner.rangeTo) : { from: date, to: date };

  const load = useCallback(
    async (mode: 'initial' | 'refresh' = 'initial') => {
      if (mode === 'refresh') setRefreshing(true);
      else setLoading(true);
      try {
        const today = todayISO();
        const yearAgo = shiftYear(today);
        const fetchFrom = tools && planner.scope === 'overdue' && bounds.from > yearAgo ? yearAgo : bounds.from;
        const fetchTo = tools && planner.scope === 'overdue' ? today : bounds.to;
        const [nextTasks, nextLists, nextProjects] = await Promise.all([
          tools && planner.scope === 'favorites'
            ? api.favorites()
            : tools && planner.scope === 'untimed'
              ? api.undated()
              : tools
                ? api.taskRange(fetchFrom, fetchTo)
                : api.listTasks(date),
          api.lists().catch(() => [] as TaskListItem[]),
          api.projects().catch(() => [] as ProjectItem[]),
        ]);
        setTasks(nextTasks.map(normalize));
        setLists(nextLists);
        setProjects(nextProjects);
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
        newOnTop: planner.newOnTop,
        manualDays: planner.manualDays,
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
      showToast(next ? 'В избранном' : 'Убрано из избранного');
    } catch (err) {
      setTasks((current) => (current.some((item) => item.id === task.id) ? current.map((item) => (item.id === task.id ? task : item)) : [task, ...current]));
      showToast(getErrorMessage(err));
    }
  };

  const placeTasks = async (day: string, ordered: Task[], moved?: { id: string; date: string }) => {
    const base = Date.now();
    const positioned = ordered.map((task, index) =>
      moved && task.id === moved.id
        ? { ...task, position: base + index, date: moved.date, repeat: 'none' as const, repeatDays: [] as number[] }
        : { ...task, position: base + index },
    );
    setTasks((current) => current.map((task) => positioned.find((item) => item.id === task.id) ?? task));
    if (day !== 'undated') {
      const manualDays = [day, ...planner.manualDays.filter((item) => item !== day)].slice(0, 80);
      planner.apply({ manualDays });
    }
    try {
      await Promise.all(
        positioned.map((task) =>
          api.updateTask(task.id, {
            position: task.position,
            ...(moved && task.id === moved.id ? { date: moved.date, repeat: 'none', repeatDays: [] } : {}),
          }),
        ),
      );
      if (moved) showToast('Дата изменена');
    } catch (err) {
      showToast(getErrorMessage(err));
      void load('refresh');
    }
  };

  const submitQuick = async () => {
    const title = draft.trim();
    if (!title) {
      setQuick(false);
      setDraft('');
      return;
    }
    if (savingQuickRef.current) return;
    savingQuickRef.current = true;
    setSavingQuick(true);
    try {
      const created = normalize(
        await api.createTask({
          title,
          date: tools && planner.scope === 'untimed' ? null : date,
          ...(tools && planner.listId ? { listId: planner.listId } : {}),
          ...(planner.newOnTop ? { position: -Date.now() } : {}),
        }),
      );
      setTasks((current) => [...current, created]);
      setDraft('');
      setQuick(false);
      showToast('Задача добавлена');
    } catch (err) {
      showToast(getErrorMessage(err));
    } finally {
      savingQuickRef.current = false;
      setSavingQuick(false);
    }
  };

  const remove = async (task: Task) => {
    setTasks((current) => current.filter((item) => item.id !== task.id));
    try {
      await api.deleteTask(task.id);
      await cancelTaskReminder(task.id);
      showToast('Задача удалена');
    } catch (err) {
      setTasks((current) => [task, ...current]);
      showToast(getErrorMessage(err));
    }
  };

  const measureList = () => {
    scrollHostRef.current?.measureInWindow((_x, y, _width, height) => {
      listFrame.current = { y, height };
    });
    wrapRef.current?.measureInWindow((_x, y) => {
      wrapTop.current = y;
    });
  };

  const hoverAt = (absoluteY: number) => {
    const contentY = absoluteY - listFrame.current.y + scrollY.current;
    let best: { key: string; day: string; taskId: string | null; y: number; height: number } | null = null;
    let bestDist = Infinity;
    for (const [key, slot] of Object.entries(slots.current)) {
      if (contentY < slot.y - 12 || contentY > slot.y + slot.height + 12) continue;
      const dist = Math.abs(contentY - (slot.y + slot.height / 2));
      if (dist < bestDist) {
        best = { key, ...slot };
        bestDist = dist;
      }
    }
    return { contentY, slot: best };
  };

  const onDragStart = (task: Task, day: string, absoluteY: number) => {
    suppressPress.current = true;
    measureList();
    setDrag({ task, day, y: absoluteY, hoverKey: null });
  };

  const onDragMove = (absoluteY: number) => {
    const { slot } = hoverAt(absoluteY);
    setDrag((current) => (current ? { ...current, y: absoluteY, hoverKey: slot?.key ?? null } : current));
    const local = absoluteY - listFrame.current.y;
    if (local < 56) scrollRef.current?.scrollTo({ y: Math.max(0, scrollY.current - 22), animated: false });
    else if (local > listFrame.current.height - 72) scrollRef.current?.scrollTo({ y: scrollY.current + 22, animated: false });
  };

  const onDragEnd = (absoluteY: number) => {
    const current = dragRef.current;
    setDrag(null);
    setTimeout(() => {
      suppressPress.current = false;
    }, 350);
    if (!current) return;
    const { contentY, slot } = hoverAt(absoluteY);
    if (!slot || slot.taskId === current.task.id) return;
    const targetDay = slot.day;
    if (!targetDay || targetDay === 'undated') return;
    if (targetDay !== current.day && (current.day === 'list' || targetDay === 'list')) return;
    const siblings = rows.flatMap((row) => (row.kind === 'task' && row.day === targetDay ? [row.task] : []));
    const without = siblings.filter((task) => task.id !== current.task.id);
    const index = slot.taskId ? without.findIndex((task) => task.id === slot.taskId) : 0;
    let at = index < 0 ? without.length : index;
    if (slot.taskId && contentY > slot.y + slot.height / 2) at += 1;
    const moving = { ...current.task, date: targetDay === current.day ? current.task.date : targetDay };
    without.splice(at, 0, moving);
    const moved = targetDay === current.day ? undefined : { id: current.task.id, date: targetDay };
    void placeTasks(targetDay, without, moved);
  };

  return (
    <View ref={wrapRef} style={styles.wrap} onLayout={measureList}>
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
        <View ref={scrollHostRef} style={styles.scroller} onLayout={measureList}>
        <ScrollView
          ref={scrollRef}
          style={styles.scroller}
          contentContainerStyle={styles.list}
          scrollEnabled={!drag}
          onScroll={(event) => {
            scrollY.current = event.nativeEvent.contentOffset.y;
          }}
          scrollEventThrottle={16}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void load('refresh')} tintColor={theme.primary} />}
          showsVerticalScrollIndicator={false}
        >
          {error ? <Text style={styles.error}>{error}</Text> : null}
          {rows.length === 0 && !error ? (
            <View style={styles.empty}>
              <Text style={styles.emptyTitle}>Задач нет</Text>
              <Text style={styles.emptyText}>
                {tools && planner.scope === 'untimed'
                  ? 'Нажмите плюс справа внизу, чтобы добавить бессрочную задачу.'
                  : 'Нажмите плюс справа внизу, чтобы добавить задачу.'}
              </Text>
            </View>
          ) : null}
          {rows.map((row) => (
              <View
                key={row.key}
                onLayout={(event) => {
                  const { y, height } = event.nativeEvent.layout;
                  slots.current[row.key] = {
                    y,
                    height,
                    day: row.day,
                    taskId: row.kind === 'task' ? row.task.id : null,
                  };
                }}
                style={drag?.hoverKey === row.key ? [styles.hover, { borderTopColor: theme.primary }] : undefined}
              >
                {row.kind === 'header' ? (
                  <Text style={styles.section}>{row.title}</Text>
                ) : (
                  <SwipeToDelete
                    draggable={tools}
                    onDelete={() => void remove(row.task)}
                    onDragStart={(absoluteY) => onDragStart(row.task, row.day, absoluteY)}
                    onDragMove={onDragMove}
                    onDragEnd={onDragEnd}
                  >
                    <View style={drag?.task.id === row.task.id ? styles.lifted : undefined}>
                      <TaskCard
                        task={row.task}
                        index={row.index}
                        {...taskBadges(row.task, lists, projects, !planner.listId)}
                        onOpenList={
                          row.task.listId
                            ? () => planner.apply({ scope: 'all', listId: row.task.listId })
                            : undefined
                        }
                        onOpenProject={() => {
                          const project = projectOf(projects, row.task.boardId);
                          if (project) router.push(`/(app)/project/${project.id}` as Href);
                        }}
                        onPress={() => {
                          if (suppressPress.current) return;
                          router.push(`/(app)/task/${row.task.id}` as Href);
                        }}
                        onToggle={() => void toggle(row.task)}
                        onFavorite={() => void favorite(row.task)}
                        onImportant={() => void toggleImportant(row.task)}
                        onToggleStep={(stepId) => void toggleStep(row.task, stepId)}
                      />
                    </View>
                  </SwipeToDelete>
                )}
              </View>
            ))}
        </ScrollView>
        </View>
      )}
      {drag ? (
        <View pointerEvents="none" style={[styles.ghost, { top: drag.y - wrapTop.current - 18 }]}>
          <Text style={styles.ghostText} numberOfLines={1}>
            {drag.task.title}
          </Text>
        </View>
      ) : null}
      <View style={styles.quickRow}>
        {quick ? (
          <TextInput
            autoFocus
            value={draft}
            onChangeText={setDraft}
            onSubmitEditing={() => void submitQuick()}
            placeholder="Новая задача"
            placeholderTextColor={colors.inkMuted}
            returnKeyType="done"
            editable={!savingQuick}
            style={styles.quickInput}
          />
        ) : null}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={quick ? 'Добавить задачу' : 'Создать задачу'}
          onPress={() => {
            if (!quick) {
              setQuick(true);
              return;
            }
            void submitQuick();
          }}
          style={[styles.fab, { backgroundColor: theme.primary }]}
        >
          {savingQuick ? <ActivityIndicator color={theme.onPrimary} /> : <Ionicons name={quick ? 'checkmark' : 'add'} size={32} color={theme.onPrimary} />}
        </Pressable>
      </View>
    </View>
  );
}

type Row =
  | { kind: 'header'; key: string; title: string; day: string }
  | { kind: 'task'; key: string; task: Task; index: number; day: string; canUp: boolean; canDown: boolean };

function buildRows(
  tasks: Task[],
  bounds: { from: string; to: string },
  planner: { sort: SortMode; listId: string | null; newOnTop: boolean; manualDays: string[]; scope: TaskScope; groupByDate: boolean; range: ViewRange },
): Row[] {
  const today = todayISO();
  let visible = tasks.filter((task) => (planner.listId ? task.listId === planner.listId : true));
  if (planner.scope === 'favorites') visible = visible.filter((task) => task.favorite);
  if (planner.scope === 'untimed') visible = visible.filter((task) => !task.date);

  if (planner.range === 'all' && planner.scope === 'all') return allTaskRows(visible, planner);

  if (planner.scope === 'favorites' || planner.scope === 'overdue' || planner.scope === 'untimed') {
    const source = planner.scope === 'overdue' ? visible.filter((task) => isOverdue(task, today)) : visible;
    if (planner.scope === 'untimed' || !planner.groupByDate) return flatRows(sortTasks(source, planner.sort, planner.newOnTop, planner.manualDays.includes('list')), 'list');
    return groupedRows(source, planner);
  }

  const rows: Row[] = [];
  let index = 0;
  if (!planner.groupByDate) {
    const seen = new Set<string>();
    for (let cursor = bounds.from; cursor <= bounds.to; cursor = nextIso(cursor)) {
      const dayTasks: Task[] = [];
      for (const task of visible) {
        if (seen.has(task.id)) continue;
        if (!occursOn(task, cursor)) continue;
        seen.add(task.id);
        dayTasks.push(task);
      }
      index = appendTasks(rows, sortTasks(dayTasks, planner.sort, planner.newOnTop, planner.manualDays.includes(cursor)), cursor, index);
    }
    return rows;
  }
  const groups = new Map<string, Task[]>();
  for (let cursor = bounds.from; cursor <= bounds.to; cursor = nextIso(cursor)) {
    const dayTasks = visible.filter((task) => occursOn(task, cursor));
    if (dayTasks.length) groups.set(cursor, sortTasks(dayTasks, planner.sort, planner.newOnTop, planner.manualDays.includes(cursor)));
  }
  for (const [day, dayTasks] of groups) {
    if (bounds.from !== bounds.to) rows.push({ kind: 'header', key: day, title: formatLongDate(day), day });
    index = appendTasks(rows, dayTasks, day, index);
  }
  return rows;
}

function allTaskRows(tasks: Task[], planner: { sort: SortMode; newOnTop: boolean; manualDays: string[]; groupByDate: boolean }): Row[] {
  if (!planner.groupByDate) return flatRows(sortTasks(tasks, planner.sort, planner.newOnTop, planner.manualDays.includes('list')), 'list');
  return groupedRows(tasks, planner);
}

function groupedRows(tasks: Task[], planner: { sort: SortMode; newOnTop: boolean; manualDays: string[] }): Row[] {
  const groups = new Map<string, Task[]>();
  for (const task of tasks) {
    const key = task.date || 'undated';
    const bucket = groups.get(key) ?? [];
    bucket.push(task);
    groups.set(key, bucket);
  }
  const rows: Row[] = [];
  let index = 0;
  for (const day of [...groups.keys()].sort()) {
    const dayTasks = sortTasks(groups.get(day) ?? [], planner.sort, planner.newOnTop, planner.manualDays.includes(day));
    rows.push({ kind: 'header', key: day, title: day === 'undated' ? 'Без даты' : formatLongDate(day), day });
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

function compareByTime(a: Task, b: Task) {
  if (a.time && b.time) {
    const byTime = a.time.localeCompare(b.time);
    if (byTime) return byTime;
  } else if (a.time) {
    return -1;
  } else if (b.time) {
    return 1;
  }
  return a.createdAt.localeCompare(b.createdAt);
}

function sortTasks(tasks: Task[], sort: SortMode, newOnTop: boolean, manual: boolean) {
  return [...tasks].sort((a, b) => {
    if (sort === 'important' && a.important !== b.important) return a.important ? -1 : 1;
    if (sort === 'time') return compareByTime(a, b);
    if (manual || newOnTop) return a.position - b.position;
    return compareByTime(a, b);
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
  hover: { borderTopWidth: 2 },
  lifted: { opacity: 0.35 },
  ghost: {
    position: 'absolute',
    left: spacing.lg,
    right: 92,
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.primary,
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
    zIndex: 5,
    elevation: 8,
  },
  ghostText: { fontSize: 16, fontWeight: '700', color: colors.ink },
  quickRow: {
    position: 'absolute',
    right: spacing.lg,
    bottom: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: spacing.sm,
    zIndex: 1,
  },
  quickInput: {
    width: 190,
    height: 48,
    borderRadius: 24,
    paddingHorizontal: 16,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    color: colors.text,
    fontSize: 16,
  },
  fab: {
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 3,
  },
});
