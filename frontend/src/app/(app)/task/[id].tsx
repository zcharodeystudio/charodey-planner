import { taskInputSchema, type RepeatMode, type RepeatUnit } from '@charodey/validation';
import { Ionicons } from '@expo/vector-icons';
import { Href, router, useLocalSearchParams, useNavigation } from 'expo-router';
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSequence, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { api, type ProjectItem, type TaskFile, type TaskListItem, type TaskStep } from '@/api/client';
import { ErrorBanner } from '@/components/ui/error-banner';
import { Input } from '@/components/ui/input';
import { WhenSheet } from '@/components/when-sheet';
import { PageSkeleton } from '@/components/ui/skeleton';
import { Screen } from '@/components/ui/screen';
import { markNewTaskRefreshing, markTaskRefreshing } from '@/lib/task-refresh';
import { WEEKDAYS, formatLongDate, remindAtFromParts, todayISO } from '@/lib/dates';
import { useAndroidBack } from '@/lib/android-back';
import { getErrorMessage } from '@/lib/errors';
import { pickAttachment, pickFromCamera } from '@/lib/files';
import { cancelTaskReminder, syncTaskReminder } from '@/lib/notifications';
import { showToast } from '@/lib/toast';
import { usePlanner } from '@/store/planner-context';
import { useSelectedDate } from '@/store/date-context';
import { useTheme } from '@/store/theme-context';
import { colors, radii, spacing } from '@/theme/theme';

const REPEAT_UNITS: { id: RepeatUnit; label: string }[] = [
  { id: 'day', label: 'дн.' },
  { id: 'week', label: 'нед.' },
  { id: 'month', label: 'мес.' },
  { id: 'year', label: 'г.' },
];

function repeatCaption(mode: RepeatMode, every: number, unit: RepeatUnit) {
  if (mode === 'none') return 'Повтор';
  if (mode === 'custom') {
    const label = REPEAT_UNITS.find((item) => item.id === unit)?.label ?? 'нед.';
    return `Каждые ${Math.max(1, every || 1)} ${label}`;
  }
  return REPEATS.find((item) => item.id === mode)?.label ?? 'Повтор';
}

const REPEATS: { id: RepeatMode; label: string }[] = [
  { id: 'none', label: 'Не повторять' },
  { id: 'daily', label: 'Ежедневно' },
  { id: 'workdays', label: 'Рабочие дни' },
  { id: 'weekdays', label: 'Будние дни' },
  { id: 'weekly', label: 'Еженедельно' },
  { id: 'monthly', label: 'Ежемесячно' },
  { id: 'yearly', label: 'Ежегодно' },
  { id: 'custom', label: 'Настроить' },
];

export default function TaskScreen() {
  const theme = useTheme();
  const planner = usePlanner();
  const navigation = useNavigation();
  const { setDate: setSelectedDate } = useSelectedDate();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ id: string; date?: string; listId?: string; boardId?: string; statusId?: string; undated?: string }>();
  const id = params.id;
  const isNew = id === 'new';
  const openedUndated = params.undated === '1';
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [title, setTitle] = useState('');
  const [note, setNote] = useState('');
  const [noteOpen, setNoteOpen] = useState(false);
  const [fileOpen, setFileOpen] = useState(false);
  const [date, setDate] = useState<string | null>(openedUndated ? null : typeof params.date === 'string' ? params.date : todayISO());
  const [timeOn, setTimeOn] = useState(false);
  const [hour, setHour] = useState(9);
  const [minute, setMinute] = useState(0);
  const [dateOpen, setDateOpen] = useState(false);
  const [dueDate, setDueDate] = useState<string | null>(null);
  const [reminderOn, setReminderOn] = useState(false);
  const [remindDate, setRemindDate] = useState(date ?? todayISO());
  const [remindHour, setRemindHour] = useState(9);
  const [remindMinute, setRemindMinute] = useState(0);
  const [remindOpen, setRemindOpen] = useState(false);
  const [repeatOpen, setRepeatOpen] = useState(false);
  const [repeat, setRepeat] = useState<RepeatMode>('none');
  const [repeatDays, setRepeatDays] = useState<number[]>([]);
  const [repeatEvery, setRepeatEvery] = useState(1);
  const [repeatUnit, setRepeatUnit] = useState<RepeatUnit>('week');
  const [unitOpen, setUnitOpen] = useState(false);
  const [important, setImportant] = useState(false);
  const [favorite, setFavorite] = useState(false);
  const [isEvent, setEvent] = useState(false);
  const [steps, setSteps] = useState<TaskStep[]>([]);
  const [stepText, setStepText] = useState('');
  const [stepOpen, setStepOpen] = useState(false);
  const [files, setFiles] = useState<TaskFile[]>([]);
  const [lists, setLists] = useState<TaskListItem[]>([]);
  const [listId, setListId] = useState<string | null>(typeof params.listId === 'string' ? params.listId : null);
  const [listOpen, setListOpen] = useState(false);
  const [listPulse, setListPulse] = useState(0);
  const [boardId, setBoardId] = useState<string | null>(typeof params.boardId === 'string' ? params.boardId : null);
  const [statusId, setStatusId] = useState<string | null>(typeof params.statusId === 'string' ? params.statusId : null);
  const [projects, setProjects] = useState<ProjectItem[]>([]);
  const [boardOpen, setBoardOpen] = useState(false);
  const [boardPulse, setBoardPulse] = useState(0);
  const [statusOpen, setStatusOpen] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [titleError, setTitleError] = useState<string>();
  const [generalError, setGeneralError] = useState<string>();
  const baseline = useRef('');
  const skipSave = useRef(false);
  const savingRef = useRef(false);
  const readyRef = useRef(isNew);
  const closeRef = useRef<(action?: unknown) => Promise<void>>(async () => undefined);
  const addStep = (text?: string) => {
    const titleText = (text ?? stepText).trim();
    if (!titleText) return;
    setSteps((current) => [...current, { id: `${Date.now()}`, title: titleText, done: false }]);
    setStepText('');
  };

  useEffect(() => {
    void api.lists().then(setLists).catch(() => undefined);
    void api.projects().then(setProjects).catch(() => undefined);
  }, []);

  const boards = projects.flatMap((item) => (item.boards ?? []).map((entry) => ({ ...entry, projectName: item.name, color: item.color })));
  const selectedBoard = boards.find((item) => item.id === boardId) ?? null;
  const columns = selectedBoard?.columns ?? [];

  const chooseList = (next: TaskListItem | null) => {
    setListOpen(false);
    if ((next?.id ?? null) === listId) return;
    setListId(next?.id ?? null);
    setListPulse((value) => value + 1);
    showToast(next ? `Добавлено в список «${next.name}»` : 'Убрано из списка');
  };

  const chooseBoard = (next: (typeof boards)[number] | null) => {
    setBoardOpen(false);
    if ((next?.id ?? null) === boardId) return;
    setBoardId(next?.id ?? null);
    setStatusId(next?.columns[0]?.id ?? null);
    setBoardPulse((value) => value + 1);
    showToast(next ? `Добавлено в доску «${next.name}»` : 'Убрано из доски');
  };

  useEffect(() => {
    if (isNew) return;
    let active = true;
    api
      .getTask(id)
      .then((task) => {
        if (!active) return;
        setTitle(task.title);
        setNote(task.note);
        if (task.note.trim()) setNoteOpen(true);
        setDate(task.date);
        setImportant(task.important);
        setFavorite(Boolean(task.favorite));
        setEvent(task.isEvent);
        setRepeat(task.repeat);
        setRepeatDays(task.repeatDays ?? []);
        setRepeatEvery(task.repeatEvery || 1);
        setRepeatUnit(task.repeatUnit ?? 'week');
        setSteps(task.steps ?? []);
        setFiles(task.files ?? []);
        setListId(task.listId);
        setDueDate(task.dueDate);
        setBoardId(task.boardId);
        setStatusId(task.statusId);
        if (task.time) {
          const [h, m] = task.time.split(':').map(Number);
          setTimeOn(true);
          setHour(h);
          setMinute(m);
        }
        if (task.remindAt) {
          const when = new Date(task.remindAt);
          const month = String(when.getMonth() + 1).padStart(2, '0');
          const day = String(when.getDate()).padStart(2, '0');
          setReminderOn(true);
          setRemindDate(`${when.getFullYear()}-${month}-${day}`);
          setRemindHour(when.getHours());
          setRemindMinute(when.getMinutes());
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

  const snapshot = () =>
    JSON.stringify({ title, note, date, timeOn, hour, minute, dueDate, reminderOn, remindDate, remindHour, remindMinute, repeat, repeatDays, repeatEvery, repeatUnit, important, favorite, isEvent, steps, files, listId, boardId, statusId, stepText });

  useEffect(() => {
    if (loading) return;
    baseline.current = snapshot();
    if (isNew || (!title.trim() && generalError)) return;
    readyRef.current = true;
  }, [loading]);

  const leave = (action?: unknown) => {
    skipSave.current = true;
    if (router.canGoBack()) {
      if (action) navigation.dispatch(action as never);
      else router.back();
      return;
    }
    router.replace('/(app)/(tabs)/today' as Href);
  };

  closeRef.current = async (action?: unknown) => {
    if (skipSave.current || savingRef.current) return;
    if (!readyRef.current) {
      leave(action);
      return;
    }
    const pending = stepText.trim();
    const nextSteps = pending ? [...steps, { id: `${Date.now()}`, title: pending, done: false }] : steps;
    if (!isNew && snapshot() === baseline.current) {
      leave(action);
      return;
    }
    if (isNew && !title.trim()) {
      leave(action);
      return;
    }
      if (date && repeat === 'monthly' && repeatDays.length === 0) {
        setGeneralError('Выберите число месяца');
        return;
      }
      if (date && repeat === 'custom' && repeatUnit === 'week' && repeatDays.length === 0) {
        setGeneralError('Выберите хотя бы один день недели');
        return;
      }
    const remindAt = reminderOn ? remindAtFromParts(remindDate, remindHour, remindMinute) : null;
    const time = timeOn ? `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}` : null;
    const parsed = taskInputSchema.safeParse({
      title,
      note,
      date,
      time,
      remindAt,
      important,
      favorite,
      isEvent,
      ...(isNew && planner.newOnTop ? { position: -Date.now() } : {}),
      repeat: date ? repeat : 'none',
      repeatDays: date ? repeatDays : [],
      repeatEvery: Math.max(1, repeatEvery || 1),
      repeatUnit,
      steps: nextSteps,
      files,
      listId,
      dueDate,
      boardId,
      statusId,
    });
    if (!parsed.success) {
      setTitleError(parsed.error.issues[0]?.message ?? 'Проверьте поля');
      return;
    }
    setTitleError(undefined);
    setGeneralError(undefined);
    savingRef.current = true;
    setSaving(true);
    try {
      const saved = isNew ? await api.createTask(parsed.data) : await api.updateTask(id, parsed.data);
      const reminderState = await syncTaskReminder(saved);
      showToast(reminderState === 'denied' ? 'Задача сохранена, но уведомления запрещены' : 'Задача сохранена');
      if (isNew) {
        const stayUntimed = planner.scope === 'untimed' && !saved.date;
        planner.apply({ scope: stayUntimed ? 'untimed' : 'all', listId: saved.listId });
        if (saved.date) setSelectedDate(saved.date);
        markNewTaskRefreshing();
        skipSave.current = true;
        router.replace('/(app)/(tabs)/today' as Href);
        return;
      }
      markTaskRefreshing(saved.id);
      leave(action);
    } catch (error) {
      setGeneralError(getErrorMessage(error));
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };

  const onHardwareBack = useCallback(() => {
    if (fileOpen) {
      setFileOpen(false);
      return true;
    }
    if (repeatOpen) {
      setRepeatOpen(false);
      return true;
    }
    if (stepOpen) {
      setStepOpen(false);
      setStepText('');
      return true;
    }
    if (remindOpen) {
      setRemindOpen(false);
      return true;
    }
    if (boardOpen) {
      setBoardOpen(false);
      return true;
    }
    if (statusOpen) {
      setStatusOpen(false);
      return true;
    }
    if (listOpen) {
      setListOpen(false);
      return true;
    }
    if (dateOpen) {
      setDateOpen(false);
      return true;
    }
    void closeRef.current();
    return true;
  }, [boardOpen, dateOpen, fileOpen, listOpen, remindOpen, repeatOpen, statusOpen, stepOpen]);
  useAndroidBack(onHardwareBack);

  useEffect(() => {
    return navigation.addListener('beforeRemove', (event) => {
      if (skipSave.current) return;
      event.preventDefault();
      if (savingRef.current) return;
      void closeRef.current(event.data.action);
    });
  }, [navigation]);

  const remove = async () => {
    skipSave.current = true;
    setRemoving(true);
    try {
      await api.deleteTask(id);
      await cancelTaskReminder(id);
      showToast('Задача удалена');
      if (router.canGoBack()) router.back();
      else router.replace('/(app)/(tabs)/today' as Href);
    } catch (error) {
      skipSave.current = false;
      setRemoving(false);
      showToast(getErrorMessage(error));
    }
  };

  if (loading) return <PageSkeleton />;

  return (
    <Screen>
      <View style={styles.top}>
        <Pressable accessibilityRole="button" accessibilityLabel="Назад" onPress={() => void closeRef.current()} hitSlop={12} style={styles.back}>
          {saving ? <ActivityIndicator color={theme.primary} /> : <Ionicons name="chevron-back" size={26} color={colors.text} />}
          <Text style={styles.backText}>Назад</Text>
        </Pressable>
        <View style={styles.topActions}>
          <HeaderIcon
            label="Важно"
            name={important ? 'flag' : 'flag-outline'}
            active={important}
            onPress={() => {
              const next = !important;
              setImportant(next);
              showToast(next ? 'Важно' : 'Важность снята');
            }}
          />
          <HeaderIcon
            label="Избранное"
            name={favorite ? 'star' : 'star-outline'}
            active={favorite}
            onPress={() => {
              const next = !favorite;
              setFavorite(next);
              showToast(next ? 'В избранном' : 'Убрано из избранного');
            }}
          />
          <HeaderIcon
            label="Событие"
            name={isEvent ? 'bookmark' : 'bookmark-outline'}
            active={isEvent}
            onPress={() => {
              const next = !isEvent;
              setEvent(next);
              showToast(next ? 'Событие' : 'Событие снято');
            }}
          />
        </View>
      </View>
      <ScrollView style={styles.scroll} contentContainerStyle={[styles.content, { paddingBottom: Math.max(insets.bottom, spacing.md) + (isNew ? spacing.xl : 108) }]} keyboardShouldPersistTaps="handled">
        <Text style={styles.heading}>{isNew ? 'Новая задача' : 'Изменить задачу'}</Text>
        <Input label="Название" value={title} onChangeText={(value) => { setTitle(value); setTitleError(undefined); }} placeholder="Например, позвонить маме" error={titleError} />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={reminderOn ? 'Напомнить' : 'Дата напоминания'}
          onPress={() => {
            setRepeatOpen(false);
            setRemindOpen(true);
          }}
          style={[styles.metaBtn, reminderOn && { borderColor: theme.primary, backgroundColor: theme.primaryMuted }]}
        >
          <Ionicons name={reminderOn ? 'notifications' : 'notifications-outline'} size={20} color={reminderOn ? theme.primary : colors.textSecondary} />
          <Text style={[styles.metaText, { color: reminderOn ? theme.primary : colors.text }]} numberOfLines={1}>
            {reminderOn
              ? `${formatLongDate(remindDate)} · ${String(remindHour).padStart(2, '0')}:${String(remindMinute).padStart(2, '0')}`
              : 'Дата напоминания'}
          </Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Дата выполнения"
          onPress={() => {
            setRepeatOpen(false);
            setDateOpen(true);
          }}
          style={[styles.metaBtn, date && { borderColor: theme.primary, backgroundColor: theme.primaryMuted }]}
        >
          <Ionicons name={date ? 'calendar' : 'calendar-outline'} size={20} color={date ? theme.primary : colors.textSecondary} />
          <Text style={[styles.metaText, { color: date ? theme.primary : colors.text }]} numberOfLines={1}>
            {date
              ? `${formatLongDate(date)}${timeOn ? ` · ${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}` : ''}`
              : 'Дата выполнения'}
          </Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={repeatCaption(repeat, repeatEvery, repeatUnit)}
          accessibilityState={{ expanded: repeatOpen }}
          onPress={() => {
            if (!date) {
              showToast('Сначала выберите дату');
              return;
            }
            setRepeatOpen((open) => !open);
          }}
          style={[styles.metaBtn, repeat !== 'none' && { borderColor: theme.primary, backgroundColor: theme.primaryMuted }]}
        >
          <Ionicons name="repeat" size={20} color={repeat !== 'none' ? theme.primary : colors.textSecondary} />
          <Text style={[styles.metaText, { color: repeat !== 'none' ? theme.primary : colors.text }]}>
            {repeatCaption(repeat, repeatEvery, repeatUnit)}
          </Text>
          <Ionicons name={repeatOpen ? 'chevron-up' : 'chevron-down'} size={16} color={repeat !== 'none' ? theme.primary : colors.textSecondary} />
        </Pressable>
        {repeatOpen ? (
          <View style={styles.dropdown}>
            {REPEATS.map((item) => {
              const active = repeat === item.id;
              return (
                <Pressable
                  key={item.id}
                  accessibilityRole="button"
                  accessibilityLabel={item.label}
                  onPress={() => {
                    setUnitOpen(false);
                    setRepeat(item.id);
                    if (item.id === 'monthly' && date) setRepeatDays([Number(date.slice(8))]);
                    else if (item.id !== 'custom') setRepeatDays([]);
                    if (item.id === 'custom' && repeat !== 'custom' && date) {
                      const [year, month, day] = date.split('-').map(Number);
                      setRepeatDays([(new Date(year, month - 1, day).getDay() + 6) % 7]);
                    }
                    if (item.id !== 'monthly' && item.id !== 'custom') setRepeatOpen(false);
                  }}
                  style={[styles.dropdownItem, active && { backgroundColor: theme.primaryMuted }]}
                >
                  <Text style={[styles.dropdownText, active && { color: theme.primary }]}>{item.label}</Text>
                  {active ? <Ionicons name="checkmark" size={18} color={theme.primary} /> : null}
                </Pressable>
              );
            })}
            {repeat === 'workdays' || repeat === 'weekdays' ? <Text style={styles.dropdownHint}>Понедельник–пятница</Text> : null}
            {repeat === 'monthly' ? (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.wrap}>
                {Array.from({ length: 31 }, (_, index) => index + 1).map((day) => (
                  <Chip key={day} label={String(day)} active={repeatDays[0] === day} onPress={() => setRepeatDays([day])} />
                ))}
              </ScrollView>
            ) : null}
            {repeat === 'custom' ? (
              <View style={styles.customRepeat}>
                <View style={styles.everyRow}>
                  <Text style={styles.everyLabel}>Повторять каждые</Text>
                  <TextInput
                    value={repeatEvery ? String(repeatEvery) : ''}
                    onChangeText={(value) => {
                      const digits = value.replace(/\D/g, '').slice(0, 2);
                      setRepeatEvery(digits ? Math.min(99, Number(digits)) : 0);
                    }}
                    onBlur={() => setRepeatEvery((value) => (value < 1 ? 1 : value))}
                    keyboardType="number-pad"
                    style={styles.everyInput}
                  />
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Единица повтора"
                    accessibilityState={{ expanded: unitOpen }}
                    onPress={() => setUnitOpen((open) => !open)}
                    style={styles.unitBtn}
                  >
                    <Text style={styles.everyLabel}>{REPEAT_UNITS.find((item) => item.id === repeatUnit)?.label}</Text>
                    <Ionicons name={unitOpen ? 'chevron-up' : 'chevron-down'} size={16} color={colors.textSecondary} />
                  </Pressable>
                </View>
                {unitOpen ? (
                  <View>
                    {REPEAT_UNITS.map((item) => (
                      <Pressable
                        key={item.id}
                        accessibilityRole="button"
                        accessibilityLabel={item.label}
                        onPress={() => {
                          setRepeatUnit(item.id);
                          setUnitOpen(false);
                        }}
                        style={[styles.dropdownItem, repeatUnit === item.id && { backgroundColor: theme.primaryMuted }]}
                      >
                        <Text style={[styles.dropdownText, repeatUnit === item.id && { color: theme.primary }]}>{item.label}</Text>
                        {repeatUnit === item.id ? <Ionicons name="checkmark" size={18} color={theme.primary} /> : null}
                      </Pressable>
                    ))}
                  </View>
                ) : null}
                {repeatUnit === 'week' || repeatUnit === 'month' ? (
                  <View style={styles.wrap}>
                    {WEEKDAYS.map((label, index) => (
                      <Chip
                        key={label}
                        label={label}
                        active={repeatDays.includes(index)}
                        onPress={() =>
                          setRepeatDays((current) => (current.includes(index) ? current.filter((day) => day !== index) : [...current, index].sort()))
                        }
                      />
                    ))}
                  </View>
                ) : null}
              </View>
            ) : null}
          </View>
        ) : null}
        <View style={styles.block}>
          <Text style={styles.label}>Шаги</Text>
          {steps.map((step) => (
            <Pressable key={step.id} onPress={() => setSteps((current) => current.map((item) => (item.id === step.id ? { ...item, done: !item.done } : item)))} style={styles.step}>
              <Ionicons name={step.done ? 'checkbox' : 'square-outline'} size={20} color={theme.primary} />
              <Text style={[styles.stepText, step.done && styles.stepDone]}>{step.title}</Text>
              <Pressable onPress={() => setSteps((current) => current.filter((item) => item.id !== step.id))}>
                <Ionicons name="close" size={18} color={colors.textSecondary} />
              </Pressable>
            </Pressable>
          ))}
          {stepOpen ? (
            <View style={styles.noteRow}>
              <TextInput
                autoFocus
                value={stepText}
                onChangeText={setStepText}
                onSubmitEditing={(event) => addStep(event.nativeEvent.text)}
                placeholder="Новый шаг"
                placeholderTextColor={colors.textSecondary}
                style={styles.stepInput}
                returnKeyType="done"
                blurOnSubmit={false}
              />
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Отменить"
                hitSlop={8}
                onPress={() => {
                  setStepOpen(false);
                  setStepText('');
                }}
              >
                <Text style={[styles.stepText, { color: theme.primary, fontWeight: '700', flex: 0 }]}>Отменить</Text>
              </Pressable>
            </View>
          ) : null}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Шаг"
            accessibilityState={{ disabled: stepOpen }}
            disabled={stepOpen}
            onPress={() => setStepOpen(true)}
            style={styles.stepAdd}
          >
            <Text style={[styles.stepText, { color: stepOpen ? colors.textSecondary : theme.primary, fontWeight: '700' }]}>+ Шаг</Text>
          </Pressable>
        </View>
        <View style={styles.pickerRow}>
          <Text style={styles.label}>Список</Text>
          <View style={styles.pickerValue}>
            <PickValue pulse={listPulse}>
              {lists.find((list) => list.id === listId) ? (
                <View style={[styles.badge, { backgroundColor: lists.find((list) => list.id === listId)?.color }]}>
                  <Text style={styles.badgeText} numberOfLines={1}>{lists.find((list) => list.id === listId)?.name}</Text>
                </View>
              ) : (
                <Text style={styles.hint}>Без списка</Text>
              )}
            </PickValue>
            <Pressable accessibilityRole="button" accessibilityLabel="Выбрать список" onPress={() => setListOpen(true)} hitSlop={8}>
              <Ionicons name="create-outline" size={20} color={theme.primary} />
            </Pressable>
          </View>
        </View>
        <View style={styles.pickerRow}>
          <Text style={styles.label}>Доска</Text>
          <View style={styles.pickerValue}>
            <PickValue pulse={boardPulse}>
              {selectedBoard ? (
                <View style={[styles.badge, { backgroundColor: selectedBoard.color }]}>
                  <Text style={styles.badgeText} numberOfLines={1}>{selectedBoard.name}</Text>
                </View>
              ) : (
                <Text style={styles.hint}>Без доски</Text>
              )}
            </PickValue>
            <Pressable accessibilityRole="button" accessibilityLabel="Выбрать доску" onPress={() => setBoardOpen(true)} hitSlop={8}>
              <Ionicons name="create-outline" size={20} color={theme.primary} />
            </Pressable>
          </View>
        </View>
        {boardId ? (
          <View style={styles.pickerRow}>
            <Text style={styles.label}>Статус</Text>
            <View style={styles.pickerValue}>
              <Text style={[styles.value, { color: theme.primary }]} numberOfLines={1}>
                {columns.find((column) => column.id === statusId)?.name ?? 'Без статуса'}
              </Text>
              <Pressable accessibilityLabel="Сменить статус" onPress={() => setStatusOpen(true)} hitSlop={8}>
                <Ionicons name="create-outline" size={20} color={theme.primary} />
              </Pressable>
            </View>
          </View>
        ) : null}
        {noteOpen ? (
          <View style={styles.noteRow}>
            <TextInput
              autoFocus={!note}
              value={note}
              onChangeText={setNote}
              placeholder="Заметка"
              placeholderTextColor={colors.textSecondary}
              multiline
              style={[styles.note, styles.noteField]}
            />
            <Pressable accessibilityRole="button" accessibilityLabel="Отменить" onPress={() => setNoteOpen(false)} hitSlop={8}>
              <Text style={[styles.stepText, { color: theme.primary, fontWeight: '700', flex: 0 }]}>Отменить</Text>
            </Pressable>
          </View>
        ) : null}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Заметка"
          accessibilityState={{ disabled: noteOpen }}
          disabled={noteOpen}
          onPress={() => setNoteOpen(true)}
          style={styles.stepAdd}
        >
          <Text style={[styles.stepText, { color: noteOpen ? colors.textSecondary : theme.primary, fontWeight: '700' }]}>+ Заметка</Text>
        </Pressable>
        {files.map((file) => (
          <View key={file.name} style={styles.step}>
            <Ionicons name="document-outline" size={18} color={colors.text} />
            <Text style={styles.stepText} numberOfLines={1}>{file.name}</Text>
            <Pressable accessibilityLabel="Убрать файл" onPress={() => setFiles((current) => current.filter((item) => item !== file))}>
              <Ionicons name="close" size={18} color={colors.textSecondary} />
            </Pressable>
          </View>
        ))}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Файл"
          accessibilityState={{ expanded: fileOpen }}
          onPress={() => {
            if (files.length >= 3) {
              showToast('Можно прикрепить до 3 файлов');
              return;
            }
            setFileOpen((open) => !open);
          }}
          style={styles.stepAdd}
        >
          <Text style={[styles.stepText, { color: theme.primary, fontWeight: '700' }]}>+ Файл</Text>
        </Pressable>
        {fileOpen ? (
          <View style={styles.fileChoices}>
            <Pressable
              accessibilityRole="button"
              onPress={() => {
                setFileOpen(false);
                void pickFromCamera().then((file) => {
                  if (file) setFiles((current) => [...current, file].slice(0, 3));
                });
              }}
              style={styles.fileChoice}
            >
              <Ionicons name="camera-outline" size={20} color={theme.primary} />
              <Text style={styles.stepText}>Камера</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              onPress={() => {
                setFileOpen(false);
                void pickAttachment().then((file) => {
                  if (file) setFiles((current) => [...current, file].slice(0, 3));
                });
              }}
              style={styles.fileChoice}
            >
              <Ionicons name="folder-open-outline" size={20} color={theme.primary} />
              <Text style={styles.stepText}>Файлы устройства</Text>
            </Pressable>
          </View>
        ) : null}
        <ErrorBanner message={generalError} />
      </ScrollView>
      <Modal visible={boardOpen} transparent animationType="fade" onRequestClose={() => setBoardOpen(false)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setBoardOpen(false)}>
          <Pressable style={[styles.modalCard, { paddingBottom: insets.bottom + spacing.xl }]} onPress={() => undefined}>
            <Text style={styles.label}>Доска</Text>
            <Pressable accessibilityRole="button" accessibilityLabel="Без доски" onPress={() => chooseBoard(null)} style={styles.listOption}>
              <Text style={styles.stepText}>Без доски</Text>
              {!selectedBoard ? <Ionicons name="checkmark" size={18} color={theme.primary} /> : null}
            </Pressable>
            <OptionScroller count={boards.length} kind="board">
              {boards.map((item) => (
                <Pressable key={item.id} accessibilityRole="button" accessibilityLabel={item.name} onPress={() => chooseBoard(item)} style={styles.listOption}>
                  <View style={styles.boardOption}>
                    <View style={[styles.badge, { backgroundColor: item.color, alignSelf: 'flex-start' }]}>
                      <Text style={styles.badgeText}>{item.name}</Text>
                    </View>
                    <Text style={styles.hint}>{item.projectName}</Text>
                  </View>
                  {boardId === item.id ? <Ionicons name="checkmark" size={18} color={theme.primary} /> : null}
                </Pressable>
              ))}
            </OptionScroller>
            {boards.length === 0 ? <Text style={styles.hint}>Досок пока нет. Создайте их в проекте.</Text> : null}
          </Pressable>
        </Pressable>
      </Modal>
      <Modal visible={statusOpen} transparent animationType="fade" onRequestClose={() => setStatusOpen(false)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setStatusOpen(false)}>
          <Pressable style={[styles.modalCard, { paddingBottom: insets.bottom + spacing.xl }]} onPress={() => undefined}>
            <Text style={styles.label}>Статус</Text>
            {columns.map((column) => (
              <Pressable
                key={column.id}
                onPress={() => {
                  setStatusId(column.id);
                  setStatusOpen(false);
                }}
                style={styles.listOption}
              >
                <Text style={styles.stepText}>{column.name}</Text>
                {statusId === column.id ? <Ionicons name="checkmark" size={18} color={theme.primary} /> : null}
              </Pressable>
            ))}
          </Pressable>
        </Pressable>
      </Modal>
      <Modal visible={listOpen} transparent animationType="fade" onRequestClose={() => setListOpen(false)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setListOpen(false)}>
          <Pressable style={[styles.modalCard, { paddingBottom: insets.bottom + spacing.xl }]} onPress={() => undefined}>
            <Text style={styles.label}>Списки</Text>
            <Pressable accessibilityRole="button" accessibilityLabel="Без списка" onPress={() => chooseList(null)} style={styles.listOption}>
              <Text style={styles.stepText}>Без списка</Text>
              {listId === null ? <Ionicons name="checkmark" size={18} color={theme.primary} /> : null}
            </Pressable>
            <OptionScroller count={lists.length} kind="list">
              {lists.map((list) => (
                <Pressable
                  key={list.id}
                  accessibilityRole="button"
                  accessibilityLabel={list.name}
                  onPress={() => chooseList(list)}
                  style={styles.listOption}
                >
                  <View style={[styles.badge, { backgroundColor: list.color }]}>
                    <Text style={styles.badgeText}>{list.name}</Text>
                  </View>
                  {listId === list.id ? <Ionicons name="checkmark" size={18} color={theme.primary} /> : null}
                </Pressable>
              ))}
            </OptionScroller>
            {lists.length === 0 ? <Text style={styles.hint}>Списков пока нет. Создайте их в профиле.</Text> : null}
          </Pressable>
        </Pressable>
      </Modal>
      <WhenSheet
        visible={dateOpen}
        date={date}
        time={timeOn ? `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}` : null}
        onClose={() => setDateOpen(false)}
        onClear={() => {
          setDate(null);
          setTimeOn(false);
          setRepeat('none');
          setRepeatDays([]);
          setRepeatOpen(false);
          setDateOpen(false);
        }}
        onApply={(nextDate, nextTime) => {
          setDate(nextDate);
          if (nextTime) {
            const [nextHour, nextMinute] = nextTime.split(':').map(Number);
            setTimeOn(true);
            setHour(nextHour);
            setMinute(nextMinute);
          } else setTimeOn(false);
          if (repeat === 'monthly') setRepeatDays([Number(nextDate.slice(8))]);
          setDateOpen(false);
        }}
      />
      <WhenSheet
        visible={remindOpen}
        requireTime
        date={remindDate}
        time={`${String(remindHour).padStart(2, '0')}:${String(remindMinute).padStart(2, '0')}`}
        onClose={() => setRemindOpen(false)}
        onClear={() => {
          setReminderOn(false);
          setRemindOpen(false);
        }}
        onApply={(nextDate, nextTime) => {
          const [nextHour, nextMinute] = (nextTime ?? '09:00').split(':').map(Number);
          setReminderOn(true);
          setRemindDate(nextDate);
          setRemindHour(nextHour);
          setRemindMinute(nextMinute);
          setRemindOpen(false);
        }}
      />
      {isNew ? null : (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Удалить"
          onPress={() => void remove()}
          style={[styles.trash, { backgroundColor: colors.error, bottom: Math.max(insets.bottom, spacing.md) }]}
        >
          {removing ? <ActivityIndicator color={colors.white} /> : <Ionicons name="trash" size={22} color={colors.white} />}
        </Pressable>
      )}
    </Screen>
  );
}

function OptionScroller({ count, kind, children }: { count: number; kind: 'list' | 'board'; children: ReactNode }) {
  if (count <= 2) return <>{children}</>;
  return (
    <ScrollView style={kind === 'board' ? styles.boardScroll : styles.listScroll} contentContainerStyle={styles.optionList} nestedScrollEnabled>
      {children}
    </ScrollView>
  );
}

function PickValue({ pulse, children }: { pulse: number; children: ReactNode }) {
  const scale = useSharedValue(1);
  useEffect(() => {
    if (pulse === 0) return;
    scale.value = withSequence(withTiming(0.86, { duration: 90 }), withTiming(1.08, { duration: 160 }), withTiming(1, { duration: 120 }));
  }, [pulse, scale]);
  const animated = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  return <Animated.View style={animated}>{children}</Animated.View>;
}

function HeaderIcon({ name, active, label, onPress }: { name: keyof typeof Ionicons.glyphMap; active: boolean; label: string; onPress: () => void }) {
  const theme = useTheme();
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} hitSlop={6} style={[styles.headerIcon, active && { backgroundColor: theme.primaryMuted }]}>
      <Ionicons name={name} size={22} color={active ? theme.primary : colors.textSecondary} />
    </Pressable>
  );
}

function Chip({ label, active, onPress, color }: { label: string; active: boolean; onPress: () => void; color?: string }) {
  const theme = useTheme();
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} style={[styles.chip, active && { backgroundColor: color ?? theme.primary, borderColor: color ?? theme.primary }]}>
      <Text style={[styles.chipText, active && { color: color ? colors.white : theme.onPrimary }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.md },
  topActions: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  headerIcon: { width: 40, height: 40, borderRadius: radii.md, alignItems: 'center', justifyContent: 'center' },
  back: { flexDirection: 'row', alignItems: 'center', minHeight: 40 },
  backText: { fontSize: 16, fontWeight: '600', color: colors.text },
  scroll: { flex: 1 },
  content: { paddingHorizontal: spacing.lg, gap: spacing.md },
  heading: { fontSize: 28, fontWeight: '800', color: colors.text },
  metaBtn: { alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minHeight: 40,
    paddingHorizontal: 10,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  metaText: { fontSize: 14, fontWeight: '700', color: colors.text },
  dropdown: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    backgroundColor: colors.surface,
    paddingVertical: spacing.xs,
    gap: spacing.xs,
  },
  dropdownItem: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 44, paddingHorizontal: spacing.md },
  dropdownText: { fontSize: 15, fontWeight: '700', color: colors.text },
  dropdownHint: { fontSize: 13, color: colors.textSecondary, paddingHorizontal: spacing.md, paddingBottom: spacing.sm },
  note: {
    minHeight: 88,
    textAlignVertical: 'top',
    paddingTop: 14,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    color: colors.ink,
    backgroundColor: colors.surface,
    fontSize: 16,
  },
  noteRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  noteField: { flex: 1 },
  label: { fontSize: 14, fontWeight: '700', color: colors.text },
  hint: { fontSize: 13, color: colors.textSecondary },
  value: { fontSize: 16, fontWeight: '700', color: colors.text },
  block: { gap: spacing.sm },
  pickerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 44, gap: spacing.md },
  pickerValue: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flexShrink: 1 },
  badge: { borderRadius: radii.full, paddingHorizontal: 10, paddingVertical: 4, maxWidth: 180 },
  badgeText: { fontSize: 13, fontWeight: '800', color: colors.ink },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(26, 8, 48, 0.62)', justifyContent: 'flex-end' },
  modalCard: { backgroundColor: colors.surface, borderTopLeftRadius: radii.xl, borderTopRightRadius: radii.xl, padding: spacing.lg, gap: spacing.sm },
  listOption: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 44 },
  optionList: { gap: spacing.sm },
  listScroll: { maxHeight: 44 * 2 + spacing.sm },
  boardScroll: { maxHeight: 64 * 2 + spacing.sm },
  boardOption: { flex: 1, gap: 2 },
  customRepeat: { gap: spacing.sm, paddingTop: spacing.xs },
  everyLabel: { fontSize: 14, fontWeight: '700', color: colors.text },
  everyRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: spacing.sm, paddingHorizontal: spacing.md },
  everyInput: {
    width: 56,
    minHeight: 40,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    textAlign: 'center',
    fontSize: 16,
    fontWeight: '800',
    color: colors.text,
    backgroundColor: colors.white,
  },
  unitBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    minHeight: 40,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    backgroundColor: colors.white,
  },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, paddingHorizontal: spacing.md, paddingBottom: spacing.sm },
  chip: { borderRadius: radii.full, paddingHorizontal: 12, paddingVertical: 8, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  chipText: { fontSize: 13, fontWeight: '700', color: colors.ink },
  step: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  stepText: { flex: 1, fontSize: 15, color: colors.text },
  stepDone: { color: colors.textSecondary, textDecorationLine: 'line-through' },
  stepAdd: { flexDirection: 'row', gap: spacing.sm },
  fileChoices: { gap: spacing.xs, paddingLeft: spacing.lg },
  fileChoice: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, minHeight: 44 },
  stepInput: { flex: 1, minHeight: 44, borderWidth: 1, borderColor: colors.border, borderRadius: radii.md, paddingHorizontal: spacing.md, color: colors.ink, backgroundColor: colors.surface },
  trash: {
    position: 'absolute',
    right: spacing.lg,
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
