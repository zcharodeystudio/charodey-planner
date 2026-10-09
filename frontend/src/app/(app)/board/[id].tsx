import { Ionicons } from '@expo/vector-icons';
import { Href, router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Gesture, GestureDetector, ScrollView } from 'react-native-gesture-handler';
import { runOnJS } from 'react-native-reanimated';
import { api, type BoardItem, type Task } from '@/api/client';
import { DoneTitle } from '@/components/done-mark';
import { Screen, ScreenLoader } from '@/components/ui/screen';
import { todayISO } from '@/lib/dates';
import { getErrorMessage } from '@/lib/errors';
import { showToast } from '@/lib/toast';
import { useTheme } from '@/store/theme-context';
import { colors, radii, spacing } from '@/theme/theme';

type Frame = { x: number; width: number };
type Drag = { task: Task; x: number; y: number; hoverId: string | null };

export default function BoardScreen() {
  const theme = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [board, setBoard] = useState<BoardItem | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [columnName, setColumnName] = useState('');
  const [addingColumn, setAddingColumn] = useState(false);
  const [drag, setDrag] = useState<Drag | null>(null);
  const rootRef = useRef<View>(null);
  const scrollHostRef = useRef<View>(null);
  const scrollRef = useRef<ScrollView>(null);
  const origin = useRef({ x: 0, y: 0 });
  const scrollX = useRef(0);
  const scrollFrame = useRef({ x: 0, width: 0 });
  const columnsFrame = useRef<Record<string, Frame>>({});
  const skipPress = useRef(false);
  const dragTask = useRef<Task | null>(null);

  const load = useCallback(() => {
    if (!id) return;
    void api
      .board(id)
      .then((data) => {
        setBoard(data.board);
        setTasks(data.tasks);
      })
      .catch((error) => showToast(getErrorMessage(error)))
      .finally(() => setLoading(false));
  }, [id]);

  useFocusEffect(load);

  const columnAt = (pageX: number) => {
    const local = pageX - scrollFrame.current.x + scrollX.current;
    const found = Object.entries(columnsFrame.current).find(([, frame]) => local >= frame.x && local <= frame.x + frame.width);
    return found?.[0] ?? null;
  };

  const addTask = async (statusId: string) => {
    const title = (drafts[statusId] ?? '').trim();
    if (!title || !id) return;
    try {
      const created = await api.createTask({ title, date: todayISO(), boardId: id, statusId });
      setTasks((current) => [created, ...current]);
      setDrafts((current) => ({ ...current, [statusId]: '' }));
      showToast('Задача добавлена');
    } catch (error) {
      showToast(getErrorMessage(error));
    }
  };

  const move = async (task: Task, statusId: string) => {
    if (task.statusId === statusId) return;
    setTasks((current) => current.map((item) => (item.id === task.id ? { ...item, statusId } : item)));
    try {
      await api.updateTask(task.id, { statusId });
      showToast('Статус изменён');
    } catch (error) {
      setTasks((current) => current.map((item) => (item.id === task.id ? task : item)));
      showToast(getErrorMessage(error));
    }
  };

  const addColumn = async () => {
    const name = columnName.trim();
    if (!name || !id) return;
    try {
      const next = await api.addBoardColumn(id, name);
      setBoard(next);
      setColumnName('');
      setAddingColumn(false);
      showToast('Колонка добавлена');
    } catch (error) {
      showToast(getErrorMessage(error));
    }
  };

  const onDragStart = (task: Task, x: number, y: number) => {
    skipPress.current = true;
    dragTask.current = task;
    rootRef.current?.measureInWindow((left, top) => {
      origin.current = { x: left, y: top };
    });
    setDrag({ task, x, y, hoverId: columnAt(x) });
  };

  const onDragMove = (x: number, y: number) => {
    const edge = 48;
    const frame = scrollFrame.current;
    if (x > frame.x + frame.width - edge) {
      scrollX.current += 18;
      scrollRef.current?.scrollTo({ x: scrollX.current, animated: false });
    } else if (x < frame.x + edge) {
      scrollX.current = Math.max(0, scrollX.current - 18);
      scrollRef.current?.scrollTo({ x: scrollX.current, animated: false });
    }
    setDrag((current) => (current ? { ...current, x, y, hoverId: columnAt(x) } : current));
  };

  const onDragEnd = (x: number) => {
    const task = dragTask.current;
    const hoverId = columnAt(x);
    dragTask.current = null;
    setDrag(null);
    if (task && hoverId) void move(task, hoverId);
    setTimeout(() => {
      skipPress.current = false;
    }, 80);
  };

  const openTask = (taskId: string) => {
    if (skipPress.current) return;
    router.push(`/(app)/task/${taskId}` as Href);
  };

  if (loading && !board) return <ScreenLoader />;

  return (
    <Screen>
      <View ref={rootRef} style={styles.root} collapsable={false}>
        <View style={styles.top}>
          <Pressable accessibilityLabel="Назад" onPress={() => router.back()} hitSlop={8} style={styles.back}>
            <Ionicons name="chevron-back" size={26} color={colors.text} />
          </Pressable>
          <Text style={styles.heading} numberOfLines={1}>
            {board?.name ?? 'Доска'}
          </Text>
          <Pressable accessibilityLabel="Колонка" onPress={() => setAddingColumn((value) => !value)} hitSlop={8} style={styles.back}>
            <Ionicons name="add" size={26} color={theme.primary} />
          </Pressable>
        </View>
        {addingColumn ? (
          <View style={styles.columnForm}>
            <TextInput value={columnName} onChangeText={setColumnName} onSubmitEditing={() => void addColumn()} placeholder="Название колонки" placeholderTextColor={colors.inkMuted} style={styles.input} />
          </View>
        ) : null}
        <View
          ref={scrollHostRef}
          style={styles.scroller}
          onLayout={() => {
            scrollHostRef.current?.measureInWindow((x, _y, width) => {
              scrollFrame.current = { x, width };
            });
          }}
        >
        <ScrollView
          ref={scrollRef}
          horizontal
          scrollEnabled={!drag}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.columns}
          onScroll={(event) => {
            scrollX.current = event.nativeEvent.contentOffset.x;
          }}
          scrollEventThrottle={16}
        >
          {(board?.columns ?? []).map((column) => {
            const cards = tasks.filter((task) => task.statusId === column.id);
            const hot = drag?.hoverId === column.id;
            return (
              <View
                key={column.id}
                onLayout={(event) => {
                  columnsFrame.current[column.id] = {
                    x: event.nativeEvent.layout.x + spacing.lg,
                    width: event.nativeEvent.layout.width,
                  };
                }}
                style={[styles.column, hot && { borderColor: theme.primary, borderWidth: 2 }]}
              >
                <View style={styles.columnHead}>
                  <Text style={styles.columnTitle}>{column.name}</Text>
                  <Text style={styles.count}>{cards.length}</Text>
                </View>
                <ScrollView style={styles.cards} contentContainerStyle={styles.cardsContent} nestedScrollEnabled scrollEnabled={!drag}>
                  {cards.map((task) => (
                    <BoardCard key={task.id} task={task} lifted={drag?.task.id === task.id} onOpen={openTask} onDragStart={onDragStart} onDragMove={onDragMove} onDragEnd={onDragEnd} />
                  ))}
                </ScrollView>
                <TextInput
                  value={drafts[column.id] ?? ''}
                  onChangeText={(value) => setDrafts((current) => ({ ...current, [column.id]: value }))}
                  onSubmitEditing={() => void addTask(column.id)}
                  placeholder="Новая задача"
                  placeholderTextColor={colors.inkMuted}
                  style={styles.input}
                />
              </View>
            );
          })}
        </ScrollView>
        </View>
        {drag ? (
          <View pointerEvents="none" style={[styles.ghost, { left: drag.x - origin.current.x - 110, top: drag.y - origin.current.y - 28 }]}>
            <Text style={styles.cardTitle} numberOfLines={2}>
              {drag.task.title}
            </Text>
          </View>
        ) : null}
      </View>
    </Screen>
  );
}

function BoardCard({
  task,
  lifted,
  onOpen,
  onDragStart,
  onDragMove,
  onDragEnd,
}: {
  task: Task;
  lifted: boolean;
  onOpen: (id: string) => void;
  onDragStart: (task: Task, x: number, y: number) => void;
  onDragMove: (x: number, y: number) => void;
  onDragEnd: (x: number) => void;
}) {
  const handlers = useRef({ task, onDragStart, onDragMove, onDragEnd, onOpen });
  handlers.current = { task, onDragStart, onDragMove, onDragEnd, onOpen };
  const call = useCallback((kind: 'start' | 'move' | 'end', x: number, y: number) => {
    const current = handlers.current;
    if (kind === 'start') current.onDragStart(current.task, x, y);
    else if (kind === 'move') current.onDragMove(x, y);
    else current.onDragEnd(x);
  }, []);
  const pan = useMemo(
    () =>
      Gesture.Pan()
        .activateAfterLongPress(280)
        .onStart((event) => {
          runOnJS(call)('start', event.absoluteX, event.absoluteY);
        })
        .onUpdate((event) => {
          runOnJS(call)('move', event.absoluteX, event.absoluteY);
        })
        .onFinalize((event) => {
          runOnJS(call)('end', event.absoluteX, event.absoluteY);
        }),
    [call],
  );

  return (
    <GestureDetector gesture={pan}>
      <Pressable onPress={() => handlers.current.onOpen(task.id)} style={[styles.card, lifted && styles.lifted]}>
        <DoneTitle text={task.title} done={task.done} numberOfLines={3} style={styles.cardTitle} />
        {task.dueDate ? <Text style={styles.due}>до {task.dueDate}</Text> : null}
      </Pressable>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  top: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.sm, gap: spacing.sm },
  back: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  heading: { flex: 1, fontSize: 22, fontWeight: '800', color: colors.text },
  columnForm: { paddingHorizontal: spacing.lg, paddingBottom: spacing.sm },
  scroller: { flex: 1 },
  columns: { paddingHorizontal: spacing.lg, paddingBottom: spacing.lg, gap: spacing.md, alignItems: 'stretch' },
  column: {
    width: 260,
    backgroundColor: '#E7D8F8',
    borderRadius: radii.lg,
    padding: spacing.sm,
    gap: spacing.sm,
    maxHeight: '100%',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  columnHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  columnTitle: { fontSize: 15, fontWeight: '800', color: colors.text },
  count: { fontSize: 13, fontWeight: '700', color: colors.textSecondary },
  cards: { flexGrow: 0, maxHeight: 420 },
  cardsContent: { gap: spacing.sm },
  card: { backgroundColor: colors.surface, borderRadius: radii.md, padding: spacing.md, borderWidth: 1, borderColor: colors.border, gap: 4 },
  lifted: { opacity: 0.35 },
  cardTitle: { fontSize: 15, fontWeight: '700', color: colors.ink },
  due: { fontSize: 12, fontWeight: '700', color: '#C026D3' },
  ghost: {
    position: 'absolute',
    width: 220,
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.primary,
    zIndex: 30,
    elevation: 8,
  },
  input: {
    minHeight: 42,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    color: colors.ink,
    backgroundColor: colors.surface,
  },
});
