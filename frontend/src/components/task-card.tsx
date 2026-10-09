import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import type { Task } from '@/api/client';
import { DoneMark, DoneTitle } from '@/components/done-mark';
import { formatLongDate, formatTime, isOverdue } from '@/lib/dates';
import { useTheme } from '@/store/theme-context';
import { colors, radii, spacing } from '@/theme/theme';

type TaskCardProps = {
  task: Task;
  index: number;
  listColor?: string;
  listName?: string;
  onOpenList?: () => void;
  projectColor?: string;
  projectName?: string;
  onOpenProject?: () => void;
  onPress: () => void;
  onToggle: () => void;
  onFavorite: () => void;
  onImportant?: () => void;
  onToggleStep?: (stepId: string) => void;
};

export function TaskCard({ task, index, listColor, listName, onOpenList, projectColor, projectName, onOpenProject, onPress, onToggle, onFavorite, onImportant, onToggleStep }: TaskCardProps) {
  const theme = useTheme();
  const [open, setOpen] = useState(false);
  const steps = task.steps ?? [];
  const doneSteps = steps.filter((step) => step.done).length;
  return (
    <Animated.View entering={FadeInDown.delay(Math.min(index, 8) * 30).duration(240)}>
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [
          styles.card,
          task.isEvent && styles.event,
          isOverdue(task) && styles.overdue,
          pressed && styles.pressed,
        ]}
      >
        <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: task.done }} accessibilityLabel={task.done ? 'Вернуть' : 'Выполнить'} onPress={onToggle} hitSlop={8}>
          <DoneMark done={task.done} color={theme.primary} />
        </Pressable>
        <View style={styles.body}>
          <View style={styles.titleRow}>
            <DoneTitle text={task.title} done={task.done} style={styles.title} />
            <Pressable accessibilityLabel={task.important ? 'Убрать важность' : 'Отметить важным'} onPress={onImportant} hitSlop={8}>
              <Ionicons name={task.important ? 'flag' : 'flag-outline'} size={16} color={task.important ? '#F97316' : colors.inkMuted} />
            </Pressable>
            <Pressable accessibilityLabel={task.favorite ? 'Убрать из избранного' : 'В избранное'} onPress={onFavorite} hitSlop={8}>
              <Ionicons name={task.favorite ? 'star' : 'star-outline'} size={18} color={task.favorite ? '#F59E0B' : colors.textSecondary} />
            </Pressable>
          </View>
          {task.note ? (
            <Text style={styles.note} numberOfLines={1}>
              {task.note}
            </Text>
          ) : null}
          <View style={styles.meta}>
            {projectName ? (
              <Pressable onPress={onOpenProject} hitSlop={6} style={[styles.listBadge, { backgroundColor: projectColor ?? theme.primaryMuted }]}>
                <Ionicons name="albums" size={11} color={colors.ink} />
                <Text style={styles.listBadgeText} numberOfLines={1}>
                  {projectName}
                </Text>
              </Pressable>
            ) : null}
            {listName ? (
              <Pressable onPress={onOpenList} hitSlop={6} style={[styles.listBadge, { backgroundColor: listColor ?? theme.primaryMuted }]}>
                <Text style={styles.listBadgeText} numberOfLines={1}>
                  {listName}
                </Text>
              </Pressable>
            ) : null}
            {task.dueDate ? <Text style={styles.due}>до {formatLongDate(task.dueDate)}</Text> : null}
            {task.time ? <Text style={[styles.metaText, { color: theme.primaryPressed }]}>{task.time}</Text> : null}
            {task.remindAt ? (
              <View style={styles.reminder}>
                <Ionicons name="notifications-outline" size={14} color={theme.primaryPressed} />
                <Text style={[styles.metaText, { color: theme.primaryPressed }]}>{formatTime(task.remindAt)}</Text>
              </View>
            ) : null}
            {task.repeat && task.repeat !== 'none' ? (
              <Ionicons name="repeat" size={14} color={colors.textSecondary} />
            ) : null}
            {task.files?.length ? <Ionicons name="attach" size={14} color={colors.textSecondary} /> : null}
            {steps.length ? (
              <Pressable accessibilityLabel={open ? 'Свернуть шаги' : 'Развернуть шаги'} onPress={() => setOpen((value) => !value)} hitSlop={6} style={styles.stepsToggle}>
                <Text style={styles.metaText}>
                  {doneSteps}/{steps.length}
                </Text>
                <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={14} color={colors.inkMuted} />
              </Pressable>
            ) : null}
            {task.isEvent ? <Text style={styles.eventLabel}>Событие</Text> : null}
          </View>
          {open && steps.length ? (
            <View style={styles.steps}>
              {steps.map((step) => (
                <Pressable key={step.id} accessibilityRole="checkbox" accessibilityState={{ checked: step.done }} accessibilityLabel={step.title} onPress={() => onToggleStep?.(step.id)} style={styles.step}>
                  <Ionicons name={step.done ? 'checkbox' : 'square-outline'} size={18} color={theme.primary} />
                  <Text style={[styles.stepText, step.done && styles.stepDone]}>{step.title}</Text>
                </Pressable>
              ))}
            </View>
          ) : null}
        </View>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  event: {
    backgroundColor: '#F8E7C8',
    borderColor: '#C084FC',
  },
  overdue: {
    backgroundColor: '#F8D5DE',
    borderColor: '#E7A3B4',
  },
  pressed: { opacity: 0.92 },
  body: { flex: 1, gap: 4 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  title: { flex: 1, fontSize: 16, fontWeight: '700', color: colors.ink },
  note: { fontSize: 13, color: colors.inkMuted },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  metaText: { fontSize: 13, fontWeight: '600', color: colors.inkMuted },
  reminder: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  listBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: radii.full, paddingHorizontal: 8, paddingVertical: 2, maxWidth: 140 },
  listBadgeText: { fontSize: 11, fontWeight: '800', color: colors.ink },
  due: { fontSize: 12, fontWeight: '700', color: '#C026D3' },
  eventLabel: { fontSize: 12, fontWeight: '700', color: '#7C3AED' },
  stepsToggle: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  steps: { gap: 4, marginTop: 4 },
  step: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 28 },
  stepText: { flex: 1, fontSize: 14, color: colors.ink },
  stepDone: { color: colors.inkMuted, textDecorationLine: 'line-through' },
});
