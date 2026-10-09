import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { api, type TaskListItem } from '@/api/client';
import { PeriodSheet } from '@/components/period-sheet';
import { TaskList } from '@/components/task-list';
import { Screen } from '@/components/ui/screen';
import { formatLongDate, todayISO, type ViewRange } from '@/lib/dates';
import { useAndroidBack } from '@/lib/android-back';
import { useSelectedDate } from '@/store/date-context';
import { SORTS, usePlanner, type TaskLayout, type TaskScope } from '@/store/planner-context';
import { useTheme } from '@/store/theme-context';
import { colors, radii, spacing } from '@/theme/theme';

const FILTERS: Array<{ kind: 'range'; id: ViewRange; label: string } | { kind: 'scope'; id: Exclude<TaskScope, 'all'>; label: string }> = [
  { kind: 'range', id: 'all', label: 'Все' },
  { kind: 'range', id: 'day', label: 'Сегодня' },
  { kind: 'range', id: 'week', label: 'Неделя' },
  { kind: 'range', id: 'month', label: 'Месяц' },
  { kind: 'range', id: 'custom', label: 'Настроить' },
  { kind: 'scope', id: 'favorites', label: 'Избранное' },
  { kind: 'scope', id: 'overdue', label: 'Просроченные' },
  { kind: 'scope', id: 'untimed', label: 'Бессрочные' },
];

const LAYOUTS: { id: TaskLayout; label: string }[] = [
  { id: 'list', label: 'Списком' },
  { id: 'dates', label: 'По датам' },
];

export default function TodayScreen() {
  const theme = useTheme();
  const planner = usePlanner();
  const { date, setDate } = useSelectedDate();
  const insets = useSafeAreaInsets();
  const [calendar, setCalendar] = useState(false);
  const [periodOpen, setPeriodOpen] = useState(false);
  const [menu, setMenu] = useState(false);
  const [lists, setLists] = useState<TaskListItem[]>([]);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      api
        .lists()
        .then((next) => {
          if (active) setLists(next);
        })
        .catch(() => undefined);
      return () => {
        active = false;
      };
    }, []),
  );

  const onHardwareBack = useCallback(() => {
    if (menu) {
      setMenu(false);
      return true;
    }
    if (periodOpen) {
      setPeriodOpen(false);
      return true;
    }
    if (calendar) {
      setCalendar(false);
      return true;
    }
    return false;
  }, [calendar, menu, periodOpen]);
  useAndroidBack(onHardwareBack);

  const listName = lists.find((list) => list.id === planner.listId)?.name;
  const period =
    planner.scope === 'favorites'
      ? 'Избранное'
      : planner.scope === 'overdue'
        ? 'Просроченные'
        : planner.scope === 'untimed'
          ? 'Бессрочные'
          : planner.range === 'all'
            ? 'Все'
            : planner.range === 'week'
              ? 'Неделя'
              : planner.range === 'month'
                ? 'Месяц'
                : planner.range === 'custom' && planner.rangeFrom && planner.rangeTo && planner.rangeFrom !== planner.rangeTo
                  ? `${formatLongDate(planner.rangeFrom)} — ${formatLongDate(planner.rangeTo)}`
                  : planner.range === 'custom' && planner.rangeFrom
                    ? formatLongDate(planner.rangeFrom)
                    : planner.range === 'custom'
                      ? 'Настроить'
                      : 'Сегодня';
  const title =
    planner.scope === 'favorites' ? 'Избранное' : planner.scope === 'overdue' ? 'Просроченные' : planner.scope === 'untimed' ? 'Бессрочные' : listName || 'Задачи';

  return (
    <Screen>
      <View style={styles.header}>
        <View style={styles.headerCopy}>
          <Text style={styles.title} numberOfLines={1}>
            {title}
          </Text>
          <View style={styles.periodRow}>
            <Pressable accessibilityRole="button" accessibilityLabel="Период" onPress={() => setPeriodOpen(true)} style={styles.periodBtn}>
              <Text style={[styles.periodText, { color: theme.primaryPressed }]} numberOfLines={1}>
                {period}
              </Text>
              <Ionicons name="chevron-down" size={16} color={theme.primaryPressed} />
            </Pressable>
            {planner.scope === 'all' && planner.range === 'custom' ? (
              <Pressable accessibilityRole="button" accessibilityLabel="Календарь" onPress={() => setCalendar(true)} hitSlop={8} style={styles.iconBtn}>
                <Ionicons name="calendar-outline" size={22} color={colors.text} />
              </Pressable>
            ) : null}
          </View>
        </View>
        <Pressable accessibilityRole="button" accessibilityLabel="Ещё" onPress={() => setMenu(true)} hitSlop={8} style={styles.iconBtn}>
          <Ionicons name="ellipsis-vertical" size={22} color={colors.text} />
        </Pressable>
      </View>
      <TaskList date={date} tools />
      <PeriodSheet visible={calendar} onClose={() => setCalendar(false)} />
      <Modal visible={periodOpen} transparent animationType="fade" onRequestClose={() => setPeriodOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setPeriodOpen(false)}>
          <View style={[styles.dropdown, { marginTop: insets.top + 72 }]}>
            {FILTERS.map((item) => {
              const active = item.kind === 'scope' ? planner.scope === item.id : planner.scope === 'all' && planner.range === item.id;
              return (
                <Pressable
                  key={item.id}
                  onPress={() => {
                    if (item.kind === 'scope') planner.apply({ scope: item.id, listId: null });
                    else {
                      if (item.id === 'day') setDate(todayISO());
                      planner.apply({ range: item.id, scope: 'all' });
                    }
                    setPeriodOpen(false);
                  }}
                  style={[styles.dropdownItem, active && { backgroundColor: theme.primaryMuted }]}
                >
                  <Text style={[styles.dropdownText, active && { color: theme.primaryPressed }]}>{item.label}</Text>
                </Pressable>
              );
            })}
          </View>
        </Pressable>
      </Modal>
      <Modal visible={menu} transparent animationType="fade" onRequestClose={() => setMenu(false)}>
        <Pressable style={styles.backdrop} onPress={() => setMenu(false)}>
          <View style={[styles.dropdown, styles.menuDrop, { marginTop: insets.top + 8 }]}>
            <Text style={styles.menuLabel}>Сортировка</Text>
            {SORTS.map((item) => {
              const active = planner.sort === item.id;
              return (
                <Pressable
                  key={item.id}
                  onPress={() => {
                    planner.setSort(active ? null : item.id);
                    setMenu(false);
                  }}
                  style={[styles.dropdownItem, active && { backgroundColor: theme.primaryMuted }]}
                >
                  <Text style={[styles.dropdownText, active && { color: theme.primaryPressed }]}>{item.label}</Text>
                </Pressable>
              );
            })}
            <Text style={styles.menuLabel}>Как показать</Text>
            {LAYOUTS.map((item) => {
              const active = planner.layout === item.id;
              return (
                <Pressable
                  key={item.id}
                  onPress={() => {
                    planner.apply({ layout: item.id });
                    setMenu(false);
                  }}
                  style={[styles.dropdownItem, active && { backgroundColor: theme.primaryMuted }]}
                >
                  <Text style={[styles.dropdownText, active && { color: theme.primaryPressed }]}>{item.label}</Text>
                </Pressable>
              );
            })}
          </View>
        </Pressable>
      </Modal>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.sm,
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    zIndex: 2,
  },
  headerCopy: { flex: 1, gap: 4 },
  periodRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  periodBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    maxWidth: '80%',
    minHeight: 36,
    paddingHorizontal: 2,
  },
  periodText: { fontWeight: '700', fontSize: 14, flexShrink: 1 },
  iconBtn: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { fontSize: 28, fontWeight: '800', color: colors.text },
  backdrop: { flex: 1, backgroundColor: 'rgba(26, 8, 48, 0.28)' },
  dropdown: {
    alignSelf: 'flex-start',
    marginLeft: spacing.lg,
    minWidth: 180,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.lg,
    paddingVertical: spacing.xs,
  },
  menuDrop: { alignSelf: 'flex-end', marginRight: spacing.lg, marginLeft: 0 },
  menuLabel: {
    fontSize: 12,
    fontWeight: '800',
    color: colors.textSecondary,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    paddingBottom: 4,
  },
  dropdownItem: { paddingHorizontal: spacing.md, paddingVertical: 12 },
  dropdownText: { fontSize: 15, fontWeight: '700', color: colors.ink },
});
