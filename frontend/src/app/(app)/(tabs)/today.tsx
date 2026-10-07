import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { useAndroidBack } from '@/lib/android-back';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { api, type TaskListItem } from '@/api/client';
import { PeriodSheet } from '@/components/period-sheet';
import { TaskList } from '@/components/task-list';
import { Screen } from '@/components/ui/screen';
import { formatLongDate, todayISO } from '@/lib/dates';
import { useSelectedDate } from '@/store/date-context';
import { SORTS, usePlanner } from '@/store/planner-context';
import { useTheme } from '@/store/theme-context';
import { colors, radii, spacing } from '@/theme/theme';

export default function TodayScreen() {
  const theme = useTheme();
  const planner = usePlanner();
  const { date } = useSelectedDate();
  const [open, setOpen] = useState(false);
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
    if (open) {
      setOpen(false);
      return true;
    }
    return false;
  }, [menu, open]);
  useAndroidBack(onHardwareBack);

  const listName = lists.find((list) => list.id === planner.listId)?.name;
  const period =
    planner.range === 'all'
      ? 'Все'
      : planner.range === 'week'
      ? 'Неделя'
      : planner.range === 'month'
        ? 'Месяц'
        : planner.range === 'custom' && planner.rangeFrom && planner.rangeTo
          ? `${formatLongDate(planner.rangeFrom)} — ${formatLongDate(planner.rangeTo)}`
          : date === todayISO()
            ? 'Сегодня'
            : formatLongDate(date);
  const title =
    planner.scope === 'favorites' ? 'Избранное' : planner.scope === 'overdue' ? 'Просроченные' : planner.scope === 'untimed' ? 'Без времени' : listName || 'Задачи';

  return (
    <Screen>
      <View style={styles.header}>
        <View style={styles.headerCopy}>
          <Text style={[styles.kicker, { color: theme.primary }]}>{period}</Text>
          <Text style={styles.title} numberOfLines={1}>
            {title}
          </Text>
        </View>
        <View style={styles.actions}>
          <Pressable accessibilityLabel="Период" onPress={() => setOpen(true)} hitSlop={10} style={styles.menu}>
            <Ionicons name="calendar-outline" size={24} color={colors.text} />
          </Pressable>
          <Pressable accessibilityLabel="Сортировка" onPress={() => setMenu(true)} hitSlop={10} style={styles.menu}>
            <Ionicons name="ellipsis-vertical" size={22} color={colors.text} />
          </Pressable>
        </View>
      </View>
      <TaskList date={date} tools />
      <PeriodSheet visible={open} onClose={() => setOpen(false)} />
      {menu ? (
        <View style={styles.backdrop}>
          <Pressable style={styles.dismiss} onPress={() => setMenu(false)} />
          <View style={styles.dropdown}>
            {SORTS.map((item) => {
              const active = planner.sort === item.id;
              return (
                <Pressable
                  key={item.id}
                  onPress={() => {
                    planner.setSort(item.id);
                    setMenu(false);
                  }}
                  style={[styles.dropdownItem, active && { backgroundColor: theme.primaryMuted }]}
                >
                  <Text style={[styles.dropdownText, active && { color: theme.primaryPressed }]}>{item.label}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      ) : null}
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
  },
  headerCopy: { flex: 1, gap: 2 },
  actions: { flexDirection: 'row', alignItems: 'center' },
  menu: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  kicker: { fontWeight: '700', fontSize: 13 },
  title: { fontSize: 28, fontWeight: '800', color: colors.text },
  backdrop: {
    position: 'fixed' as 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    zIndex: 1000,
  },
  dismiss: { ...StyleSheet.absoluteFill },
  dropdown: {
    position: 'absolute',
    top: 56,
    right: spacing.lg,
    minWidth: 180,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.lg,
    paddingVertical: spacing.xs,
    gap: 2,
  },
  dropdownItem: { paddingHorizontal: spacing.md, paddingVertical: 12, borderRadius: radii.md, marginHorizontal: spacing.xs },
  dropdownText: { fontSize: 15, fontWeight: '700', color: colors.ink },
});
