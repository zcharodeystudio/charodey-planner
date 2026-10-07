import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import type { Task } from '@/api/client';
import { DoneMark, DoneTitle } from '@/components/done-mark';
import { formatTime } from '@/lib/dates';
import { useTheme } from '@/store/theme-context';
import { colors, radii, spacing } from '@/theme/theme';

type TaskCardProps = {
  task: Task;
  index: number;
  listColor?: string;
  onPress: () => void;
  onToggle: () => void;
  onFavorite: () => void;
  onImportant?: () => void;
  onToggleStep?: (stepId: string) => void;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
};

export function TaskCard({ task, index, listColor, onPress, onToggle, onFavorite, onImportant, onToggleStep, onMoveUp, onMoveDown }: TaskCardProps) {
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
            {listColor ? <View style={[styles.listDot, { backgroundColor: listColor }]} /> : null}
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
        {onMoveUp || onMoveDown ? (
          <View style={styles.moves}>
            <Pressable onPress={onMoveUp} disabled={!onMoveUp} hitSlop={6} style={!onMoveUp && styles.moveOff}>
              <Ionicons name="chevron-up" size={18} color={colors.text} />
            </Pressable>
            <Pressable onPress={onMoveDown} disabled={!onMoveDown} hitSlop={6} style={!onMoveDown && styles.moveOff}>
              <Ionicons name="chevron-down" size={18} color={colors.text} />
            </Pressable>
          </View>
        ) : null}
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
  pressed: { opacity: 0.92 },
  body: { flex: 1, gap: 4 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  title: { flex: 1, fontSize: 16, fontWeight: '700', color: colors.ink },
  note: { fontSize: 13, color: colors.inkMuted },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  metaText: { fontSize: 13, fontWeight: '600', color: colors.inkMuted },
  reminder: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  listDot: { width: 8, height: 8, borderRadius: 4 },
  eventLabel: { fontSize: 12, fontWeight: '700', color: '#7C3AED' },
  stepsToggle: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  steps: { gap: 4, marginTop: 4 },
  step: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 28 },
  stepText: { flex: 1, fontSize: 14, color: colors.ink },
  stepDone: { color: colors.inkMuted, textDecorationLine: 'line-through' },
  moves: { gap: 2 },
  moveOff: { opacity: 0.25 },
});
