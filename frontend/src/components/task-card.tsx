import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import type { Task } from '@/api/client';
import { formatTime } from '@/lib/dates';
import { colors, radii, spacing } from '@/theme/theme';

type TaskCardProps = {
  task: Task;
  index: number;
  onPress: () => void;
  onToggle: () => void;
};

export function TaskCard({ task, index, onPress, onToggle }: TaskCardProps) {
  return (
    <Animated.View entering={FadeInDown.delay(Math.min(index, 8) * 40).duration(280)}>
      <Pressable onPress={onPress} style={({ pressed }) => [styles.card, pressed && styles.pressed]}>
        <Pressable onPress={onToggle} hitSlop={8} style={[styles.check, task.done && styles.checkDone]}>
          {task.done ? <Ionicons name="checkmark" size={16} color={colors.white} /> : null}
        </Pressable>
        <View style={styles.body}>
          <Text style={[styles.title, task.done && styles.done]} numberOfLines={2}>
            {task.title}
          </Text>
          {task.note ? (
            <Text style={styles.note} numberOfLines={1}>
              {task.note}
            </Text>
          ) : null}
          {task.remindAt ? (
            <View style={styles.reminder}>
              <Ionicons name="notifications-outline" size={14} color={colors.primaryPressed} />
              <Text style={styles.reminderText}>{formatTime(task.remindAt)}</Text>
            </View>
          ) : null}
        </View>
        <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
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
  pressed: {
    opacity: 0.9,
  },
  check: {
    width: 26,
    height: 26,
    borderRadius: radii.full,
    borderWidth: 2,
    borderColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkDone: {
    backgroundColor: colors.primary,
  },
  body: {
    flex: 1,
    gap: 4,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
  },
  done: {
    color: colors.textSecondary,
    textDecorationLine: 'line-through',
  },
  note: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  reminder: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  reminderText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.primaryPressed,
  },
});
