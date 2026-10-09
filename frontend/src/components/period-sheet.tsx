import { useEffect, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MonthCalendar } from '@/components/month-calendar';
import { formatLongDate, parseISODate } from '@/lib/dates';
import { useSelectedDate } from '@/store/date-context';
import { usePlanner } from '@/store/planner-context';
import { colors, radii, spacing } from '@/theme/theme';

export function PeriodSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const planner = usePlanner();
  const { date, setDate } = useSelectedDate();
  const insets = useSafeAreaInsets();
  const [start, setStart] = useState<string | null>(null);
  const [from, setFrom] = useState<string | null>(planner.rangeFrom);
  const [to, setTo] = useState<string | null>(planner.rangeTo);
  const anchor = start ?? from ?? date;
  const selected = parseISODate(anchor);
  const [cursor, setCursor] = useState({ year: selected.getFullYear(), month: selected.getMonth() });

  useEffect(() => {
    if (!visible) return;
    setStart(null);
    setFrom(planner.rangeFrom);
    setTo(planner.rangeTo);
    const next = parseISODate(planner.rangeFrom ?? date);
    setCursor({ year: next.getFullYear(), month: next.getMonth() });
  }, [date, planner.rangeFrom, planner.rangeTo, visible]);

  const close = () => {
    const day = start ?? (from && !to ? from : null);
    if (day) {
      setDate(day);
      planner.apply({ range: 'custom', rangeFrom: day, rangeTo: day });
    } else if (from && to) {
      setDate(from);
      planner.apply({ range: 'custom', rangeFrom: from, rangeTo: to });
    }
    onClose();
  };

  const pick = (iso: string) => {
    if (!start) {
      setStart(iso);
      setFrom(iso);
      setTo(null);
      return;
    }
    if (start === iso) {
      setFrom(iso);
      setTo(iso);
      setStart(null);
      return;
    }
    const nextFrom = start <= iso ? start : iso;
    const nextTo = start <= iso ? iso : start;
    setFrom(nextFrom);
    setTo(nextTo);
    setStart(null);
  };

  const shiftMonth = (delta: number) => {
    const next = new Date(cursor.year, cursor.month + delta, 1);
    setCursor({ year: next.getFullYear(), month: next.getMonth() });
  };

  const rangeText = start
    ? `${formatLongDate(start)} — выберите конец или закройте`
    : from && to && from !== to
      ? `${formatLongDate(from)} — ${formatLongDate(to)}`
      : from
        ? formatLongDate(from)
        : 'Выберите день или промежуток';

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={close}>
      <Pressable style={styles.backdrop} onPress={close}>
        <Pressable style={[styles.panel, { marginTop: insets.top + 12 }]} onPress={() => undefined}>
          <Text style={styles.heading}>Настроить</Text>
          <Text style={styles.range}>{rangeText}</Text>
          <MonthCalendar
            embedded
            year={cursor.year}
            month={cursor.month}
            selected=""
            rangeStart={start ?? from}
            rangeEnd={start ? null : to}
            marked={new Set()}
            onSelect={pick}
            onPrev={() => shiftMonth(-1)}
            onNext={() => shiftMonth(1)}
          />
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(26, 8, 48, 0.62)',
    paddingHorizontal: spacing.lg,
  },
  panel: {
    alignSelf: 'center',
    width: '100%',
    maxWidth: 430,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.xl,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  heading: { fontSize: 14, fontWeight: '800', color: colors.ink },
  range: { fontSize: 14, fontWeight: '700', color: colors.inkMuted },
});
