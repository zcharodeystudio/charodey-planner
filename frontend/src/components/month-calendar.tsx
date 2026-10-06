import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { WEEKDAYS, formatMonthTitle, monthCells, todayISO } from '@/lib/dates';
import { colors, radii, spacing } from '@/theme/theme';

type MonthCalendarProps = {
  year: number;
  month: number;
  selected: string;
  marked: Set<string>;
  onSelect: (date: string) => void;
  onPrev: () => void;
  onNext: () => void;
};

export function MonthCalendar({ year, month, selected, marked, onSelect, onPrev, onNext }: MonthCalendarProps) {
  const today = todayISO();
  const cells = monthCells(year, month);

  return (
    <View style={styles.wrap}>
      <View style={styles.header}>
        <Pressable onPress={onPrev} hitSlop={10} style={styles.arrow}>
          <Ionicons name="chevron-back" size={22} color={colors.text} />
        </Pressable>
        <Text style={styles.title}>{formatMonthTitle(year, month)}</Text>
        <Pressable onPress={onNext} hitSlop={10} style={styles.arrow}>
          <Ionicons name="chevron-forward" size={22} color={colors.text} />
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
          const active = date === selected;
          const isToday = date === today;
          return (
            <Pressable key={date} onPress={() => onSelect(date)} style={[styles.cell, active && styles.cellActive]}>
              <Text style={[styles.day, active && styles.dayActive, isToday && !active && styles.dayToday]}>
                {Number(date.slice(-2))}
              </Text>
              {marked.has(date) ? <View style={[styles.dot, active && styles.dotActive]} /> : <View style={styles.dotSpace} />}
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
    gap: spacing.sm,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.text,
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
    color: colors.textSecondary,
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
  cellActive: {
    backgroundColor: colors.primary,
  },
  day: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text,
  },
  dayActive: {
    color: colors.white,
  },
  dayToday: {
    color: colors.primaryPressed,
  },
  dot: {
    width: 5,
    height: 5,
    borderRadius: radii.full,
    backgroundColor: colors.primary,
    marginTop: 3,
  },
  dotActive: {
    backgroundColor: colors.white,
  },
  dotSpace: {
    height: 8,
  },
});
