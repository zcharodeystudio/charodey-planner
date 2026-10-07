import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { WEEKDAYS, formatMonthTitle, monthCells, todayISO } from '@/lib/dates';
import { useTheme } from '@/store/theme-context';
import { colors, radii, spacing } from '@/theme/theme';

type MonthCalendarProps = {
  year: number;
  month: number;
  selected: string;
  marked: Set<string>;
  onSelect: (date: string) => void;
  onPrev: () => void;
  onNext: () => void;
  embedded?: boolean;
  rangeStart?: string | null;
  rangeEnd?: string | null;
};

export function MonthCalendar({ year, month, selected, marked, onSelect, onPrev, onNext, embedded, rangeStart, rangeEnd }: MonthCalendarProps) {
  const theme = useTheme();
  const today = todayISO();
  const cells = monthCells(year, month);

  return (
    <View style={[styles.wrap, embedded && styles.embedded]}>
      <View style={styles.header}>
        <Pressable onPress={onPrev} hitSlop={10} style={styles.arrow}>
          <Ionicons name="chevron-back" size={22} color={colors.ink} />
        </Pressable>
        <Text style={styles.title}>{formatMonthTitle(year, month)}</Text>
        <Pressable onPress={onNext} hitSlop={10} style={styles.arrow}>
          <Ionicons name="chevron-forward" size={22} color={colors.ink} />
        </Pressable>
      </View>
      <View style={styles.weekdays}>
        {WEEKDAYS.map((day) => (
          <Text key={day} style={styles.weekday}>
            {day}
          </Text>
        ))}
      </View>
      <Animated.View key={`${year}-${month}`} entering={FadeIn.duration(220)} style={styles.grid}>
        {cells.map((date, index) => {
          if (!date) return <View key={`empty-${index}`} style={styles.cell} />;
          const hasRange = Boolean(rangeStart && rangeEnd);
          const edge = hasRange && (date === rangeStart || date === rangeEnd);
          const between = hasRange && date > (rangeStart as string) && date < (rangeEnd as string);
          const active = hasRange ? edge : rangeStart ? date === rangeStart : date === selected;
          const isToday = date === today;
          return (
            <Pressable
              key={date}
              accessibilityRole="button"
              accessibilityLabel={String(Number(date.slice(-2)))}
              onPress={() => onSelect(date)}
              style={[styles.cell, between && { backgroundColor: theme.primaryMuted }, active && { backgroundColor: theme.primary }]}
            >
              <Text style={[styles.day, active && { color: theme.onPrimary }, between && { color: theme.primaryPressed }, isToday && !active && !between && { color: theme.primaryPressed }]}>
                {Number(date.slice(-2))}
              </Text>
              {marked.has(date) ? <View style={[styles.dot, { backgroundColor: theme.primary }, active && styles.dotActive]} /> : <View style={styles.dotSpace} />}
            </Pressable>
          );
        })}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  embedded: {
    paddingHorizontal: 0,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.ink,
    textTransform: 'capitalize',
  },
  arrow: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  weekdays: {
    flexDirection: 'row',
  },
  weekday: {
    flex: 1,
    textAlign: 'center',
    color: colors.inkMuted,
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  cell: {
    width: '14.285%',
    alignItems: 'center',
    paddingVertical: 6,
    borderRadius: radii.md,
  },
  day: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.ink,
  },
  dot: {
    width: 5,
    height: 5,
    borderRadius: radii.full,
    marginTop: 3,
  },
  dotActive: {
    backgroundColor: colors.ink,
  },
  dotSpace: {
    height: 8,
  },
});
