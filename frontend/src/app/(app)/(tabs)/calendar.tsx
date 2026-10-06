import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { api } from '@/api/client';
import { MonthCalendar } from '@/components/month-calendar';
import { TaskList } from '@/components/task-list';
import { Screen } from '@/components/ui/screen';
import { formatISODate, formatLongDate, parseISODate } from '@/lib/dates';
import { useSelectedDate } from '@/store/date-context';
import { colors, spacing } from '@/theme/theme';

export default function CalendarScreen() {
  const { date, setDate } = useSelectedDate();
  const selected = parseISODate(date);
  const [cursor, setCursor] = useState({ year: selected.getFullYear(), month: selected.getMonth() });
  const [marked, setMarked] = useState<Set<string>>(new Set());

  useEffect(() => {
    const next = parseISODate(date);
    setCursor({ year: next.getFullYear(), month: next.getMonth() });
  }, [date]);

  useEffect(() => {
    const from = formatISODate(new Date(cursor.year, cursor.month, 1));
    const to = formatISODate(new Date(cursor.year, cursor.month + 1, 0));
    let active = true;
    api
      .taskDates(from, to)
      .then((result) => {
        if (active) setMarked(new Set(result.dates));
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [cursor.month, cursor.year, date]);

  const shiftMonth = (delta: number) => {
    const next = new Date(cursor.year, cursor.month + delta, 1);
    setCursor({ year: next.getFullYear(), month: next.getMonth() });
  };

  return (
    <Screen>
      <Text style={styles.heading}>Даты</Text>
      <MonthCalendar
        year={cursor.year}
        month={cursor.month}
        selected={date}
        marked={marked}
        onSelect={setDate}
        onPrev={() => shiftMonth(-1)}
        onNext={() => shiftMonth(1)}
      />
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{formatLongDate(date)}</Text>
      </View>
      <TaskList date={date} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  heading: {
    fontSize: 28,
    fontWeight: '800',
    color: colors.text,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
  },
  section: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.text,
  },
});
