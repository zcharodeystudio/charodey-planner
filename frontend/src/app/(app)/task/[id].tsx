import { taskInputSchema } from '@charodey/validation';
import { Ionicons } from '@expo/vector-icons';
import { Href, router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { api } from '@/api/client';
import { ConfirmModal } from '@/components/confirm-modal';
import { Button } from '@/components/ui/button';
import { ErrorBanner } from '@/components/ui/error-banner';
import { Input } from '@/components/ui/input';
import { Screen, ScreenLoader } from '@/components/ui/screen';
import { formatLongDate, remindAtFromParts, todayISO } from '@/lib/dates';
import { getErrorMessage } from '@/lib/errors';
import { cancelTaskReminder, syncTaskReminder } from '@/lib/notifications';
import { showToast } from '@/lib/toast';
import { colors, radii, spacing } from '@/theme/theme';

export default function TaskScreen() {
  const params = useLocalSearchParams<{ id: string; date?: string }>();
  const id = params.id;
  const isNew = id === 'new';
  const initialDate = typeof params.date === 'string' ? params.date : todayISO();

  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [title, setTitle] = useState('');
  const [note, setNote] = useState('');
  const [date, setDate] = useState(initialDate);
  const [reminderOn, setReminderOn] = useState(false);
  const [hour, setHour] = useState(9);
  const [minute, setMinute] = useState(0);
  const [titleError, setTitleError] = useState<string>();
  const [generalError, setGeneralError] = useState<string>();
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    if (isNew) return;
    let active = true;
    api
      .getTask(id)
      .then((task) => {
        if (!active) return;
        setTitle(task.title);
        setNote(task.note);
        setDate(task.date);
        if (task.remindAt) {
          const remind = new Date(task.remindAt);
          setReminderOn(true);
          setHour(remind.getHours());
          setMinute(remind.getMinutes());
        }
      })
      .catch((error) => {
        if (active) setGeneralError(getErrorMessage(error));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [id, isNew]);

  const shiftDate = (days: number) => {
    const [year, month, day] = date.split('-').map(Number);
    const next = new Date(year, month - 1, day + days);
    const monthText = String(next.getMonth() + 1).padStart(2, '0');
    const dayText = String(next.getDate()).padStart(2, '0');
    setDate(`${next.getFullYear()}-${monthText}-${dayText}`);
  };

  const save = async () => {
    const remindAt = reminderOn ? remindAtFromParts(date, hour, minute) : null;
    const parsed = taskInputSchema.safeParse({ title, note, date, remindAt });
    if (!parsed.success) {
      setTitleError(parsed.error.issues[0]?.message ?? 'Проверьте поля');
      return;
    }
    setTitleError(undefined);
    setGeneralError(undefined);
    setSaving(true);
    try {
      const saved = isNew
        ? await api.createTask(parsed.data)
        : await api.updateTask(id, parsed.data);
      const reminder = await syncTaskReminder(saved);
      if (reminder === 'denied') {
        showToast('Задача сохранена, но уведомления запрещены в системе');
      }
      router.back();
    } catch (error) {
      setGeneralError(getErrorMessage(error));
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    setConfirmDelete(false);
    try {
      await api.deleteTask(id);
      await cancelTaskReminder(id);
      router.back();
    } catch (error) {
      showToast(getErrorMessage(error));
    }
  };

  if (loading) return <ScreenLoader />;

  return (
    <Screen>
      <View style={styles.top}>
        <Pressable onPress={() => router.back()} hitSlop={12} style={styles.back}>
          <Ionicons name="chevron-back" size={26} color={colors.text} />
          <Text style={styles.backText}>Назад</Text>
        </Pressable>
      </View>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.heading}>{isNew ? 'Новая задача' : 'Изменить задачу'}</Text>
        <Input
          label="Название"
          value={title}
          onChangeText={(value) => {
            setTitle(value);
            setTitleError(undefined);
          }}
          placeholder="Например, позвонить маме"
          error={titleError}
        />
        <Input
          label="Заметка"
          value={note}
          onChangeText={setNote}
          placeholder="Необязательно"
          multiline
          style={{ minHeight: 88, textAlignVertical: 'top', paddingTop: 14 }}
        />
        <View style={styles.dateRow}>
          <Text style={styles.label}>Дата</Text>
          <View style={styles.dateControls}>
            <Pressable onPress={() => shiftDate(-1)} style={styles.stepper}>
              <Ionicons name="chevron-back" size={20} color={colors.text} />
            </Pressable>
            <Text style={styles.dateValue}>{formatLongDate(date)}</Text>
            <Pressable onPress={() => shiftDate(1)} style={styles.stepper}>
              <Ionicons name="chevron-forward" size={20} color={colors.text} />
            </Pressable>
          </View>
        </View>
        <View style={styles.reminderRow}>
          <View style={styles.reminderCopy}>
            <Text style={styles.label}>Напоминание</Text>
            <Text style={styles.hint}>Уведомление в выбранное время</Text>
          </View>
          <Switch
            value={reminderOn}
            onValueChange={setReminderOn}
            trackColor={{ true: colors.primary, false: colors.border }}
            thumbColor={colors.white}
          />
        </View>
        {reminderOn ? (
          <View style={styles.timeRow}>
            <TimeStepper label="Часы" value={hour} max={23} onChange={setHour} />
            <TimeStepper label="Минуты" value={minute} max={59} step={5} onChange={setMinute} />
          </View>
        ) : null}
        <ErrorBanner message={generalError} />
        <Button title={isNew ? 'Создать' : 'Сохранить'} onPress={() => void save()} loading={saving} />
        {isNew ? null : <Button title="Удалить задачу" variant="danger" onPress={() => setConfirmDelete(true)} />}
        <Pressable onPress={() => router.replace('/(app)/(tabs)/today' as Href)}>
          <Text style={styles.homeLink}>К списку задач</Text>
        </Pressable>
      </ScrollView>
      <ConfirmModal
        visible={confirmDelete}
        title="Удалить задачу?"
        message="Напоминание тоже будет снято."
        onClose={() => setConfirmDelete(false)}
        onConfirm={() => void remove()}
      />
    </Screen>
  );
}

function TimeStepper({
  label,
  value,
  max,
  step = 1,
  onChange,
}: {
  label: string;
  value: number;
  max: number;
  step?: number;
  onChange: (value: number) => void;
}) {
  const cycle = (delta: number) => {
    const span = max + 1;
    onChange((value + delta + span) % span);
  };
  return (
    <View style={styles.stepperBlock}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.dateControls}>
        <Pressable onPress={() => cycle(-step)} style={styles.stepper}>
          <Ionicons name="remove" size={18} color={colors.text} />
        </Pressable>
        <Text style={styles.dateValue}>{String(value).padStart(2, '0')}</Text>
        <Pressable onPress={() => cycle(step)} style={styles.stepper}>
          <Ionicons name="add" size={18} color={colors.text} />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  top: {
    paddingHorizontal: spacing.md,
  },
  back: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    minHeight: 40,
  },
  backText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
  },
  content: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xl,
    gap: spacing.md,
  },
  heading: {
    fontSize: 28,
    fontWeight: '800',
    color: colors.text,
  },
  label: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.text,
  },
  hint: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  dateRow: {
    gap: spacing.sm,
  },
  dateControls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    minHeight: 52,
    paddingHorizontal: spacing.sm,
  },
  dateValue: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
  },
  stepper: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  reminderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  reminderCopy: {
    flex: 1,
    gap: 2,
  },
  timeRow: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  stepperBlock: {
    flex: 1,
    gap: spacing.sm,
  },
  homeLink: {
    textAlign: 'center',
    color: colors.primaryPressed,
    fontWeight: '700',
    paddingVertical: spacing.sm,
  },
});
