import { useEffect, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View, type GestureResponderEvent } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MonthCalendar } from '@/components/month-calendar';
import { datePresets, formatLongDate, parseISODate, todayISO } from '@/lib/dates';
import { useTheme } from '@/store/theme-context';
import { colors, radii, spacing } from '@/theme/theme';

const CLOCK = 264;
const CLOCK_CENTER = CLOCK / 2;
const OUTER_R = 98;
const INNER_R = 62;
const MARK = 36;
const HOUR_OUTER = [12, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
const HOUR_INNER = [0, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23];
const MINUTES = [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55];

export function WhenSheet({
  visible,
  date,
  time,
  onClose,
  onApply,
  onClear,
  requireTime = false,
}: {
  visible: boolean;
  date: string | null;
  time: string | null;
  onClose: () => void;
  onApply: (date: string, time: string | null) => void;
  onClear?: () => void;
  requireTime?: boolean;
}) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const [page, setPage] = useState<'date' | 'time'>('date');
  const [clockMode, setClockMode] = useState<'hour' | 'minute'>('hour');
  const [draftDate, setDraftDate] = useState(date ?? todayISO());
  const [hour, setHour] = useState(9);
  const [minute, setMinute] = useState(0);
  const selected = parseISODate(draftDate);
  const clock = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;

  const open = () => {
    const nextDate = date ?? todayISO();
    setDraftDate(nextDate);
    setPage('date');
    setClockMode('hour');
    if (time) {
      const [nextHour, nextMinute] = time.split(':').map(Number);
      setHour(nextHour);
      setMinute(nextMinute);
    } else {
      const now = new Date();
      setHour(now.getHours());
      setMinute(now.getMinutes());
    }
  };

  useEffect(() => {
    if (visible) open();
  }, [visible]);

  const applyPreset = (nextDate: string, nextTime: string | null) => {
    setDraftDate(nextDate);
    if (!nextTime) return;
    const [nextHour, nextMinute] = nextTime.split(':').map(Number);
    setHour(nextHour);
    setMinute(nextMinute);
  };

  const close = () => {
    if (page === 'time') {
      setPage('date');
      return;
    }
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onShow={open} onRequestClose={close}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={[styles.sheet, { paddingBottom: insets.bottom + spacing.xl }]} onPress={() => undefined}>
          {page === 'date' ? (
            <>
              <Text style={styles.summary}>{formatLongDate(draftDate)}</Text>
              <View style={styles.presets}>
                {datePresets().map((item) => (
                  <Pressable key={item.id} onPress={() => applyPreset(item.date, item.time)} style={[styles.chip, { borderColor: theme.primary }]}>
                    <Text style={[styles.chipText, { color: theme.primaryPressed }]}>{item.label}</Text>
                  </Pressable>
                ))}
              </View>
              <MonthCalendar
                embedded
                year={selected.getFullYear()}
                month={selected.getMonth()}
                selected={draftDate}
                marked={new Set()}
                onSelect={setDraftDate}
                onPrev={() => setDraftDate(shiftMonth(draftDate, -1))}
                onNext={() => setDraftDate(shiftMonth(draftDate, 1))}
              />
              <View style={styles.actions}>
                <Pressable onPress={onClose} style={styles.action}>
                  <Text style={styles.actionText}>Отмена</Text>
                </Pressable>
                <Pressable
                  onPress={() => {
                    setClockMode('hour');
                    setPage('time');
                  }}
                  style={[styles.action, { backgroundColor: theme.primary }]}
                >
                  <Text style={[styles.actionText, { color: theme.onPrimary }]}>Сохранить</Text>
                </Pressable>
              </View>
              {onClear ? (
                <Pressable onPress={onClear}>
                  <Text style={[styles.clear, { color: theme.primary }]}>Убрать дату</Text>
                </Pressable>
              ) : null}
            </>
          ) : (
            <>
              <Text style={styles.summary}>{formatLongDate(draftDate)}</Text>
              <View style={styles.digital}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Часы"
                  onPress={() => setClockMode('hour')}
                  style={[styles.digitalPart, clockMode === 'hour' && { backgroundColor: theme.primaryMuted }]}
                >
                  <Text style={[styles.digitalText, clockMode === 'hour' && { color: theme.primary }]}>{String(hour).padStart(2, '0')}</Text>
                </Pressable>
                <Text style={styles.digitalColon}>:</Text>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Минуты"
                  onPress={() => setClockMode('minute')}
                  style={[styles.digitalPart, clockMode === 'minute' && { backgroundColor: theme.primaryMuted }]}
                >
                  <Text style={[styles.digitalText, clockMode === 'minute' && { color: theme.primary }]}>{String(minute).padStart(2, '0')}</Text>
                </Pressable>
              </View>
              <Text style={styles.hint}>{clockMode === 'hour' ? 'Выберите час' : 'Выберите минуты'}</Text>
              <ClockFace
                mode={clockMode}
                hour={hour}
                minute={minute}
                onHour={(value) => {
                  setHour(value);
                  setClockMode('minute');
                }}
                onMinute={setMinute}
              />
              <View style={styles.actions}>
                <Pressable onPress={() => setPage('date')} style={styles.action}>
                  <Text style={styles.actionText}>Назад</Text>
                </Pressable>
                <Pressable onPress={() => onApply(draftDate, clock)} style={[styles.action, { backgroundColor: theme.primary }]}>
                  <Text style={[styles.actionText, { color: theme.onPrimary }]}>Сохранить</Text>
                </Pressable>
              </View>
              {requireTime ? null : (
                <Pressable onPress={() => onApply(draftDate, null)}>
                  <Text style={[styles.clear, { color: theme.primary }]}>Без времени</Text>
                </Pressable>
              )}
            </>
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function ClockFace({
  mode,
  hour,
  minute,
  onHour,
  onMinute,
}: {
  mode: 'hour' | 'minute';
  hour: number;
  minute: number;
  onHour: (value: number) => void;
  onMinute: (value: number) => void;
}) {
  const theme = useTheme();
  const handLength = mode === 'minute' || (hour > 0 && hour <= 12) ? OUTER_R : INNER_R;
  const handAngle = mode === 'minute' ? minute * 6 : (hour % 12) * 30;
  const selectMinute = (event: GestureResponderEvent) => {
    const { locationX, locationY } = event.nativeEvent;
    const dx = locationX - CLOCK_CENTER;
    const dy = locationY - CLOCK_CENTER;
    if (dx * dx + dy * dy < 28 * 28) return;
    const degrees = (Math.atan2(dy, dx) * 180) / Math.PI + 90;
    const normalized = (degrees + 360) % 360;
    onMinute(Math.round(normalized / 6) % 60);
  };

  return (
    <View style={styles.clock}>
      <View style={styles.dial} />
      {Array.from({ length: 60 }, (_, index) => (
        <View key={index} pointerEvents="none" style={[styles.tickWrap, { transform: [{ rotate: `${index * 6}deg` }] }]}>
          <View style={[styles.tick, index % 5 === 0 ? styles.tickMajor : styles.tickMinor]} />
        </View>
      ))}
      <View pointerEvents="none" style={[styles.handWrap, { height: handLength * 2, top: CLOCK_CENTER - handLength, transform: [{ rotate: `${handAngle}deg` }] }]}>
        <View style={[styles.hand, { height: handLength, backgroundColor: theme.primary }]} />
      </View>
      <View pointerEvents="none" style={[styles.knob, { backgroundColor: theme.primary }]} />
      {mode === 'hour' ? (
        <>
          {HOUR_OUTER.map((value, index) => (
            <Mark key={value} label={String(value)} index={index} radius={OUTER_R} active={hour === value} onPress={() => onHour(value)} />
          ))}
          {HOUR_INNER.map((value, index) => (
            <Mark key={value} label={String(value).padStart(2, '0')} index={index} radius={INNER_R} active={hour === value} small onPress={() => onHour(value)} />
          ))}
        </>
      ) : (
        <>
          {MINUTES.map((value, index) => (
            <Mark key={value} label={String(value).padStart(2, '0')} index={index} radius={OUTER_R} active={minute === value} onPress={() => onMinute(value)} />
          ))}
          {minute % 5 === 0 ? null : (
            <Mark label={String(minute).padStart(2, '0')} index={minute} total={60} radius={OUTER_R} active onPress={() => undefined} />
          )}
          <View
            style={styles.minuteLayer}
            onStartShouldSetResponder={() => true}
            onMoveShouldSetResponder={() => true}
            onResponderGrant={selectMinute}
            onResponderMove={selectMinute}
          />
        </>
      )}
    </View>
  );
}

function Mark({
  label,
  index,
  radius,
  active,
  small,
  total = 12,
  onPress,
}: {
  label: string;
  index: number;
  radius: number;
  active: boolean;
  small?: boolean;
  total?: number;
  onPress: () => void;
}) {
  const theme = useTheme();
  const angle = (index / total) * Math.PI * 2 - Math.PI / 2;
  const left = CLOCK_CENTER + Math.cos(angle) * radius - MARK / 2;
  const top = CLOCK_CENTER + Math.sin(angle) * radius - MARK / 2;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={[styles.mark, { left, top }, active && { backgroundColor: theme.primary }]}
    >
      <Text style={[styles.markText, small && styles.markTextSmall, active && { color: theme.onPrimary }]}>{label}</Text>
    </Pressable>
  );
}

function shiftMonth(iso: string, delta: number) {
  const date = parseISODate(iso);
  const next = new Date(date.getFullYear(), date.getMonth() + delta, 1);
  const month = String(next.getMonth() + 1).padStart(2, '0');
  return `${next.getFullYear()}-${month}-01`;
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(26, 8, 48, 0.62)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radii.xl,
    borderTopRightRadius: radii.xl,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  summary: { fontSize: 16, fontWeight: '800', color: colors.text },
  presets: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: { borderWidth: 1, borderRadius: radii.full, paddingHorizontal: 12, paddingVertical: 8, backgroundColor: colors.white },
  chipText: { fontSize: 13, fontWeight: '700' },
  actions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm },
  action: { flex: 1, minHeight: 48, borderRadius: radii.md, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background },
  actionText: { fontSize: 16, fontWeight: '800', color: colors.text },
  clear: { textAlign: 'center', fontSize: 14, fontWeight: '700', paddingVertical: spacing.sm },
  digital: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4 },
  digitalPart: { minWidth: 64, borderRadius: radii.md, paddingHorizontal: 10, paddingVertical: 4, alignItems: 'center' },
  digitalText: { fontSize: 36, fontWeight: '800', color: colors.textSecondary },
  digitalColon: { fontSize: 36, fontWeight: '800', color: colors.text },
  hint: { textAlign: 'center', fontSize: 13, fontWeight: '700', color: colors.textSecondary },
  clock: { width: CLOCK, height: CLOCK, alignSelf: 'center' },
  dial: {
    position: 'absolute',
    width: CLOCK,
    height: CLOCK,
    borderRadius: CLOCK / 2,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
  },
  tickWrap: { position: 'absolute', width: CLOCK, height: CLOCK, alignItems: 'center' },
  tick: { backgroundColor: colors.inkMuted, marginTop: 8 },
  tickMajor: { width: 2, height: 10 },
  tickMinor: { width: 1, height: 5, opacity: 0.45 },
  handWrap: { position: 'absolute', width: 2, left: CLOCK_CENTER - 1 },
  hand: { width: 2, borderRadius: 1 },
  knob: { position: 'absolute', width: 8, height: 8, borderRadius: 4, left: CLOCK_CENTER - 4, top: CLOCK_CENTER - 4 },
  minuteLayer: { position: 'absolute', left: 0, top: 0, width: CLOCK, height: CLOCK },
  mark: { position: 'absolute', width: MARK, height: MARK, borderRadius: MARK / 2, alignItems: 'center', justifyContent: 'center' },
  markText: { fontSize: 14, fontWeight: '800', color: colors.text },
  markTextSmall: { fontSize: 11 },
});
