import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { Task, TaskListItem } from '@/api/client';
import { DoneMark, DoneTitle } from '@/components/done-mark';
import { SwipeToDelete } from '@/components/swipe-to-delete';
import { useTheme } from '@/store/theme-context';
import { colors, radii, spacing } from '@/theme/theme';

type TableRow =
  | { kind: 'header'; key: string; title: string }
  | { kind: 'task'; key: string; task: Task; day: string; canUp: boolean; canDown: boolean };

export function TaskTable({
  rows,
  lists,
  reorder,
  onOpen,
  onToggle,
  onFavorite,
  onImportant,
  onToggleStep,
  onMove,
  onDelete,
}: {
  rows: TableRow[];
  lists: TaskListItem[];
  reorder: boolean;
  onOpen: (task: Task) => void;
  onToggle: (task: Task) => void;
  onFavorite: (task: Task) => void;
  onImportant: (task: Task) => void;
  onToggleStep: (task: Task, stepId: string) => void;
  onMove: (day: string, id: string, delta: -1 | 1) => void;
  onDelete: (task: Task) => void;
}) {
  const theme = useTheme();
  const [open, setOpen] = useState<Record<string, boolean>>({});
  return (
    <View style={[styles.table, { borderColor: colors.border }]}>
      <View style={[styles.head, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        <View style={styles.check} />
        <Text style={[styles.headText, styles.title]}>Задача</Text>
        <Text style={[styles.headText, styles.date]}>Дата</Text>
        <Text style={[styles.headText, styles.time]}>Время</Text>
        <View style={styles.star} />
        {reorder ? <View style={styles.moves} /> : null}
      </View>
      {rows.map((row) =>
        row.kind === 'header' ? (
          <Text key={row.key} style={styles.section}>
            {row.title}
          </Text>
        ) : (
          <SwipeToDelete key={row.key} rounded={false} onDelete={() => onDelete(row.task)}>
            <View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={row.task.title}
              onPress={() => onOpen(row.task)}
              style={[
                styles.line,
                { borderBottomColor: colors.border, borderLeftColor: lists.find((list) => list.id === row.task.listId)?.color ?? 'transparent' },
              ]}
            >
              <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: row.task.done }} accessibilityLabel={row.task.done ? 'Вернуть' : 'Выполнить'} hitSlop={6} onPress={() => onToggle(row.task)}>
                <DoneMark done={row.task.done} color={theme.primary} size={22} radius={6} />
              </Pressable>
              <View style={styles.title}>
                <Pressable accessibilityLabel={row.task.important ? 'Убрать важность' : 'Отметить важным'} hitSlop={6} onPress={() => onImportant(row.task)}>
                  <Ionicons name={row.task.important ? 'flag' : 'flag-outline'} size={13} color={row.task.important ? '#F97316' : colors.inkMuted} />
                </Pressable>
                <DoneTitle text={row.task.title} done={row.task.done} numberOfLines={1} style={styles.titleText} />
              </View>
              <Text style={styles.date}>{shortDate(row.task.date)}</Text>
              <Text style={styles.time}>{row.task.time ?? '—'}</Text>
              <Pressable accessibilityLabel={row.task.favorite ? 'Убрать из избранного' : 'В избранное'} hitSlop={6} onPress={() => onFavorite(row.task)} style={styles.star}>
                <Ionicons name={row.task.favorite ? 'star' : 'star-outline'} size={16} color={row.task.favorite ? '#F59E0B' : colors.textSecondary} />
              </Pressable>
              {row.task.steps?.length ? (
                <Pressable
                  accessibilityLabel={open[row.task.id] ? 'Свернуть шаги' : 'Развернуть шаги'}
                  hitSlop={6}
                  onPress={() => setOpen((current) => ({ ...current, [row.task.id]: !current[row.task.id] }))}
                >
                  <Ionicons name={open[row.task.id] ? 'chevron-up' : 'chevron-down'} size={16} color={colors.inkMuted} />
                </Pressable>
              ) : null}
              {reorder ? (
                <View style={styles.moves}>
                  <Pressable accessibilityLabel="Выше" disabled={!row.canUp} hitSlop={4} onPress={() => onMove(row.day, row.task.id, -1)}>
                    <Ionicons name="chevron-up" size={16} color={row.canUp ? colors.text : colors.border} />
                  </Pressable>
                  <Pressable accessibilityLabel="Ниже" disabled={!row.canDown} hitSlop={4} onPress={() => onMove(row.day, row.task.id, 1)}>
                    <Ionicons name="chevron-down" size={16} color={row.canDown ? colors.text : colors.border} />
                  </Pressable>
                </View>
              ) : null}
            </Pressable>
            {open[row.task.id] && row.task.steps?.length ? (
              <View style={styles.steps}>
                {row.task.steps.map((step) => (
                  <Pressable key={step.id} accessibilityRole="checkbox" accessibilityState={{ checked: step.done }} accessibilityLabel={step.title} onPress={() => onToggleStep(row.task, step.id)} style={styles.step}>
                    <Ionicons name={step.done ? 'checkbox' : 'square-outline'} size={16} color={theme.primary} />
                    <Text style={[styles.stepText, step.done && styles.stepDone]}>{step.title}</Text>
                  </Pressable>
                ))}
              </View>
            ) : null}
            </View>
          </SwipeToDelete>
        ),
      )}
    </View>
  );
}

function shortDate(iso: string) {
  const [, month, day] = iso.split('-');
  return `${day}.${month}`;
}

const styles = StyleSheet.create({
  table: { borderWidth: 1, borderRadius: radii.md },
  head: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: spacing.sm, paddingVertical: 8, borderBottomWidth: 1 },
  headText: { fontSize: 11, fontWeight: '800', color: colors.inkMuted },
  line: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minHeight: 44,
    paddingHorizontal: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderLeftWidth: 3,
    backgroundColor: colors.surface,
  },
  check: { width: 22, height: 22 },
  title: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 4, minWidth: 0 },
  titleText: { fontSize: 14, fontWeight: '700', color: colors.ink },
  date: { width: 46, fontSize: 12, fontWeight: '600', color: colors.inkMuted },
  time: { width: 42, fontSize: 12, fontWeight: '600', color: colors.ink },
  star: { width: 22, alignItems: 'center', justifyContent: 'center' },
  moves: { width: 18, alignItems: 'center' },
  section: { fontSize: 13, fontWeight: '800', color: colors.inkMuted, paddingHorizontal: spacing.sm, paddingVertical: 8, backgroundColor: '#EBD7A8' },
  steps: { paddingLeft: 36, paddingRight: spacing.sm, paddingBottom: 8, gap: 4, backgroundColor: colors.surface },
  step: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 28 },
  stepText: { flex: 1, fontSize: 13, color: colors.ink },
  stepDone: { color: colors.inkMuted, textDecorationLine: 'line-through' },
});
