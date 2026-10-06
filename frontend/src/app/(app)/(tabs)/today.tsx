import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useEffect, useState } from 'react';
import { api } from '@/api/client';
import { TaskList } from '@/components/task-list';
import { Screen } from '@/components/ui/screen';
import { formatLongDate, todayISO, weekDays } from '@/lib/dates';
import { useSelectedDate } from '@/store/date-context';
import { colors, radii, spacing } from '@/theme/theme';

export default function TodayScreen() {
  const { date, setDate } = useSelectedDate();
  const days = weekDays(date);
  const [marked, setMarked] = useState<Set<string>>(new Set());

  useEffect(() => {
    let active = true;
    api
      .taskDates(days[0], days[6])
      .then((result) => {
        if (active) setMarked(new Set(result.dates));
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [days[0], days[6]]);

  return (
    <Screen>
      <View style={styles.header}>
        <Text style={styles.kicker}>{date === todayISO() ? 'Сегодня' : 'Выбранный день'}</Text>
        <Text style={styles.title}>{formatLongDate(date)}</Text>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.week}>
        {days.map((day) => {
          const active = day === date;
          return (
            <Pressable key={day} onPress={() => setDate(day)} style={[styles.day, active && styles.dayActive]}>
              <Text style={[styles.dayNum, active && styles.dayNumActive]}>{Number(day.slice(-2))}</Text>
              {marked.has(day) ? <View style={[styles.dot, active && styles.dotActive]} /> : <View style={styles.dotSpace} />}
            </Pressable>
          );
        })}
      </ScrollView>
      {date !== todayISO() ? (
        <Pressable onPress={() => setDate(todayISO())} style={styles.backToday}>
          <Text style={styles.backTodayText}>Вернуться к сегодня</Text>
        </Pressable>
      ) : null}
      <TaskList date={date} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    gap: 2,
  },
  kicker: {
    color: colors.primaryPressed,
    fontWeight: '700',
    fontSize: 13,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: colors.text,
  },
  week: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    gap: spacing.sm,
  },
  day: {
    width: 46,
    height: 58,
    borderRadius: radii.lg,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  dayActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  dayNum: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
  },
  dayNumActive: {
    color: colors.white,
  },
  dot: {
    width: 5,
    height: 5,
    borderRadius: radii.full,
    backgroundColor: colors.primary,
    marginTop: 4,
  },
  dotActive: {
    backgroundColor: colors.white,
  },
  dotSpace: {
    height: 9,
  },
  backToday: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.sm,
  },
  backTodayText: {
    color: colors.primaryPressed,
    fontWeight: '700',
  },
});
