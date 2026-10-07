import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { MonthCalendar } from '@/components/month-calendar';
import { formatLongDate, parseISODate, todayISO, type ViewRange } from '@/lib/dates';
import { useSelectedDate } from '@/store/date-context';
import { usePlanner } from '@/store/planner-context';
import { useTheme } from '@/store/theme-context';
import { colors, radii, spacing } from '@/theme/theme';

const RANGES: { id: ViewRange; label: string }[] = [
  { id: 'all', label: 'Все' },
  { id: 'day', label: 'День' },
  { id: 'week', label: 'Неделя' },
  { id: 'month', label: 'Месяц' },
  { id: 'custom', label: 'Промежуток' },
];

export function PeriodSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const theme = useTheme();
  const planner = usePlanner();
  const { date, setDate } = useSelectedDate();
  const [start, setStart] = useState<string | null>(null);
  const anchor = start ?? (planner.range === 'custom' ? planner.rangeFrom : null) ?? date;
  const selected = parseISODate(anchor);
  const [cursor, setCursor] = useState({ year: selected.getFullYear(), month: selected.getMonth() });

  useEffect(() => {
    if (!visible) {
      setStart(null);
      return;
    }
    const next = parseISODate(anchor);
    setCursor({ year: next.getFullYear(), month: next.getMonth() });
  }, [anchor, visible]);

  if (!visible) return null;

  const pick = (iso: string) => {
    if (planner.range === 'custom') {
      if (!start) {
        setStart(iso);
        return;
      }
      const from = start <= iso ? start : iso;
      const to = start <= iso ? iso : start;
      planner.apply({ range: 'custom', rangeFrom: from, rangeTo: to });
      setStart(null);
      return;
    }
    setDate(iso);
    if (planner.range !== 'day' && planner.range !== 'week' && planner.range !== 'month') planner.apply({ range: 'day' });
  };

  const shiftMonth = (delta: number) => {
    const next = new Date(cursor.year, cursor.month + delta, 1);
    setCursor({ year: next.getFullYear(), month: next.getMonth() });
  };

  const rangeText = start
    ? `${formatLongDate(start)} —`
    : planner.rangeFrom && planner.rangeTo
      ? `${formatLongDate(planner.rangeFrom)} — ${formatLongDate(planner.rangeTo)}`
      : null;

  return (
    <View style={styles.backdrop}>
      <Pressable style={styles.dismiss} onPress={onClose} />
      <View style={styles.panel}>
        <ScrollView style={styles.scroll} contentContainerStyle={styles.sheet} keyboardShouldPersistTaps="handled">
          <Text style={styles.heading}>Период</Text>
          <View style={styles.row}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Сегодня"
              onPress={() => {
                setStart(null);
                setDate(todayISO());
                planner.apply({ range: 'day' });
              }}
              style={[styles.chip, date === todayISO() && planner.range === 'day' && { backgroundColor: theme.primary, borderColor: theme.primary }]}
            >
              <Text style={[styles.chipText, date === todayISO() && planner.range === 'day' && styles.chipTextOn]}>Сегодня</Text>
            </Pressable>
            {RANGES.map((item) => {
              const active = planner.range === item.id;
              return (
                <Pressable
                  key={item.id}
                  accessibilityRole="button"
                  accessibilityLabel={item.id === 'custom' && active && rangeText ? `Промежуток, ${rangeText}` : item.label}
                  onPress={() => {
                    if (item.id === 'custom') {
                      setStart(null);
                      planner.apply({ range: 'custom' });
                      return;
                    }
                    setStart(null);
                    planner.apply({ range: item.id });
                  }}
                  style={[styles.chip, item.id === 'custom' && styles.rangeChip, active && { backgroundColor: theme.primary, borderColor: theme.primary }]}
                >
                  <Text style={[styles.chipText, active && styles.chipTextOn]}>{item.label}</Text>
                  {item.id === 'custom' && active && rangeText ? (
                    <Text style={[styles.rangeText, styles.chipTextOn]}>{rangeText}</Text>
                  ) : null}
                </Pressable>
              );
            })}
          </View>
          <MonthCalendar
            embedded
            year={cursor.year}
            month={cursor.month}
            selected={planner.range === 'custom' || planner.range === 'all' ? '' : anchor}
            rangeStart={planner.range === 'custom' ? (start ?? planner.rangeFrom) : null}
            rangeEnd={planner.range === 'custom' && !start ? planner.rangeTo : null}
            marked={new Set()}
            onSelect={pick}
            onPrev={() => shiftMonth(-1)}
            onNext={() => shiftMonth(1)}
          />
        </ScrollView>
        <Text style={styles.heading}>Как показать</Text>
        <View style={styles.row}>
          {(
            [
              ['list', 'Списком'],
              ['dates', 'По датам'],
              ['table', 'Таблица'],
            ] as const
          ).map(([id, label]) => (
            <Pressable
              key={id}
              accessibilityRole="button"
              accessibilityLabel={label}
              onPress={() => planner.apply({ layout: id })}
              style={[styles.chip, planner.layout === id && { backgroundColor: theme.primary, borderColor: theme.primary }]}
            >
              <Text style={[styles.chipText, planner.layout === id && styles.chipTextOn]}>{label}</Text>
            </Pressable>
          ))}
        </View>
        <Pressable accessibilityRole="button" accessibilityLabel="Готово" onPress={onClose} style={[styles.done, { backgroundColor: theme.primary }]}>
          <Text style={[styles.doneText, { color: theme.onPrimary }]}>Готово</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    position: 'fixed' as 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    zIndex: 1000,
    backgroundColor: 'rgba(26, 8, 48, 0.62)',
    paddingTop: 72,
    paddingHorizontal: spacing.lg,
  },
  dismiss: { ...StyleSheet.absoluteFill },
  panel: {
    zIndex: 1,
    alignSelf: 'center',
    width: '100%',
    maxWidth: 430,
    maxHeight: '88%',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.xl,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  scroll: { flexShrink: 1 },
  sheet: { gap: spacing.sm },
  heading: { fontSize: 14, fontWeight: '800', color: colors.ink, marginTop: spacing.sm },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: {
    borderRadius: radii.full,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#EBD7A8',
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipText: { fontSize: 13, fontWeight: '700', color: colors.ink },
  chipTextOn: { color: colors.ink },
  rangeChip: { width: '100%', alignItems: 'flex-start' },
  rangeText: { fontSize: 13, fontWeight: '700' },
  done: { marginTop: spacing.sm, minHeight: 48, borderRadius: radii.lg, alignItems: 'center', justifyContent: 'center' },
  doneText: { color: colors.white, fontSize: 16, fontWeight: '800' },
});
