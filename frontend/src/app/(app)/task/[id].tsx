import { taskInputSchema, type RepeatMode } from '@charodey/validation';
import { Ionicons } from '@expo/vector-icons';
import { Href, router, useLocalSearchParams, useNavigation } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { api, type BoardItem, type ProjectItem, type TaskFile, type TaskListItem, type TaskStep } from '@/api/client';
import { MonthCalendar } from '@/components/month-calendar';
import { Button } from '@/components/ui/button';
import { ErrorBanner } from '@/components/ui/error-banner';
import { Input } from '@/components/ui/input';
import { Screen, ScreenLoader } from '@/components/ui/screen';
import { WEEKDAYS, formatLongDate, parseISODate, remindAtFromParts, todayISO } from '@/lib/dates';
import { useAndroidBack } from '@/lib/android-back';
import { getErrorMessage } from '@/lib/errors';
import { pickAttachment } from '@/lib/files';
import { cancelTaskReminder, syncTaskReminder } from '@/lib/notifications';
import { showToast } from '@/lib/toast';
import { usePlanner } from '@/store/planner-context';
import { useSelectedDate } from '@/store/date-context';
import { useTheme } from '@/store/theme-context';
import { colors, radii, spacing } from '@/theme/theme';

const REPEATS: { id: RepeatMode; label: string }[] = [
  { id: 'none', label: 'Не повторять' },
  { id: 'daily', label: 'Ежедневно' },
  { id: 'workdays', label: 'Рабочие дни' },
  { id: 'weekdays', label: 'Будние дни' },
  { id: 'weekly', label: 'Еженедельно' },
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
  const [date, setDate] = useState<string | null>(openedUndated ? null : typeof params.date === 'string' ? params.date : todayISO());
  const [timeOn, setTimeOn] = useState(false);
  const [hour, setHour] = useState(9);
  const [minute, setMinute] = useState(0);
  const [dateOpen, setDateOpen] = useState(false);
  const [dueDate, setDueDate] = useState<string | null>(null);
  const [dueOpen, setDueOpen] = useState(false);
  const [reminderOn, setReminderOn] = useState(false);
  const [remindDate, setRemindDate] = useState(date ?? todayISO());
  const [remindHour, setRemindHour] = useState(9);
  const [remindMinute, setRemindMinute] = useState(0);
  const [remindOpen, setRemindOpen] = useState(false);
  const [repeat, setRepeat] = useState<RepeatMode>('none');
  const [repeatDays, setRepeatDays] = useState<number[]>([]);
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
  const [boardId, setBoardId] = useState<string | null>(typeof params.boardId === 'string' ? params.boardId : null);
  const [statusId, setStatusId] = useState<string | null>(typeof params.statusId === 'string' ? params.statusId : null);
  const [projects, setProjects] = useState<ProjectItem[]>([]);
  const [projectOpen, setProjectOpen] = useState(false);
  const [boardOpen, setBoardOpen] = useState(false);
  const [statusOpen, setStatusOpen] = useState(false);
  const [titleError, setTitleError] = useState<string>();
  const [generalError, setGeneralError] = useState<string>();
  const skipSave = useRef(false);
  const savingRef = useRef(false);
  const readyRef = useRef(isNew);
  const closeRef = useRef<(action?: unknown) => Promise<void>>(async () => undefined);
  const addStep = (text?: string) => {
    const titleText = (text ?? stepText).trim();
    if (!titleText) return;
    setSteps((current) => [...current, { id: `${Date.now()}`, title: titleText, done: false }]);
    setStepText('');
    setStepOpen(false);
  };

  const calendarAnchor = date ?? todayISO();
  const selected = parseISODate(calendarAnchor);
  const reminder = parseISODate(remindDate);

  useEffect(() => {
    void api.lists().then(setLists).catch(() => undefined);
    void api.projects().then(setProjects).catch(() => undefined);
  }, []);

  const project = projects.find((item) => item.boards?.some((board) => board.id === boardId)) ?? null;
  const board = project?.boards?.find((item) => item.id === boardId) ?? null;
  const columns = board?.columns ?? [];

  const assignProject = (next: ProjectItem | null) => {
    if (!next) {
      setBoardId(null);
      setStatusId(null);
      setProjectOpen(false);
      return;
    }
    const boards = next.boards ?? [];
    if (!boards.length) {
      showToast('В этом проекте ещё нет доски');
      return;
    }
    const nextBoard = boards.find((item) => item.id === boardId) ?? boards[0];
    setBoardId(nextBoard.id);
    if (!nextBoard.columns.some((column) => column.id === statusId)) setStatusId(nextBoard.columns[0]?.id ?? null);
    setProjectOpen(false);
  };

  const assignBoard = (next: BoardItem) => {
    setBoardId(next.id);
    setStatusId(next.columns[0]?.id ?? null);
    setBoardOpen(false);
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
        setDate(task.date);
        setImportant(task.important);
        setFavorite(Boolean(task.favorite));
        setEvent(task.isEvent);
        setRepeat(task.repeat);
        setRepeatDays(task.repeatDays ?? []);
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

  useEffect(() => {
    if (isNew || loading) return;
    if (!title.trim() && generalError) return;
    readyRef.current = true;
  }, [generalError, isNew, loading, title]);

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
    if (isNew && !title.trim()) {
      leave(action);
      return;
    }
    if (date && repeat === 'custom' && repeatDays.length === 0) {
      setGeneralError('Выберите хотя бы один день повтора');
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
        skipSave.current = true;
        router.replace('/(app)/(tabs)/today' as Href);
        return;
      }
      leave(action);
    } catch (error) {
      setGeneralError(getErrorMessage(error));
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };

  const onHardwareBack = useCallback(() => {
    if (stepOpen) {
      setStepOpen(false);
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
    if (projectOpen) {
      setProjectOpen(false);
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
    if (dueOpen) {
      setDueOpen(false);
      return true;
    }
    if (dateOpen) {
      setDateOpen(false);
      return true;
    }
    void closeRef.current();
    return true;
  }, [boardOpen, dateOpen, dueOpen, listOpen, projectOpen, remindOpen, statusOpen, stepOpen]);
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
    try {
      await api.deleteTask(id);
      await cancelTaskReminder(id);
      showToast('Задача удалена');
      if (router.canGoBack()) router.back();
      else router.replace('/(app)/(tabs)/today' as Href);
    } catch (error) {
      skipSave.current = false;
      showToast(getErrorMessage(error));
    }
  };

  if (loading) return <ScreenLoader />;

  return (
    <Screen>
      <View style={styles.top}>
        <Pressable accessibilityRole="button" accessibilityLabel="Назад" onPress={() => void closeRef.current()} hitSlop={12} style={styles.back}>
          {saving ? <ActivityIndicator color={theme.primary} /> : <Ionicons name="chevron-back" size={26} color={colors.text} />}
          <Text style={styles.backText}>Назад</Text>
        </Pressable>
      </View>
      <ScrollView style={styles.scroll} contentContainerStyle={[styles.content, { paddingBottom: Math.max(insets.bottom, spacing.md) + (isNew ? spacing.xl : 108) }]} keyboardShouldPersistTaps="handled">
        <Text style={styles.heading}>{isNew ? 'Новая задача' : 'Изменить задачу'}</Text>
        <Input label="Название" value={title} onChangeText={(value) => { setTitle(value); setTitleError(undefined); }} placeholder="Например, позвонить маме" error={titleError} />
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
          ) : (
            <Pressable onPress={() => setStepOpen(true)} style={styles.stepAdd}>
              <Ionicons name="add" size={20} color={theme.primary} />
              <Text style={[styles.stepText, { color: theme.primary, fontWeight: '700' }]}>Шаг</Text>
            </Pressable>
          )}
        </View>
        <Flag label="Важно" value={important} onChange={setImportant} icon="flag" />
        <Flag label="В избранном" hint="Попадёт в список избранных" value={favorite} onChange={setFavorite} icon="star" />
        <Flag label="Событие" hint="Подсветится на списке" value={isEvent} onChange={setEvent} icon="calendar" />
        <View style={styles.pickerRow}>
          <Text style={styles.label}>Список</Text>
          <View style={styles.pickerValue}>
            {lists.find((list) => list.id === listId) ? (
              <View style={[styles.badge, { backgroundColor: lists.find((list) => list.id === listId)?.color }]}>
                <Text style={styles.badgeText} numberOfLines={1}>{lists.find((list) => list.id === listId)?.name}</Text>
              </View>
            ) : (
              <Text style={styles.hint}>Без списка</Text>
            )}
            <Pressable accessibilityLabel="Выбрать список" onPress={() => setListOpen(true)} hitSlop={8}>
              <Ionicons name="create-outline" size={20} color={theme.primary} />
            </Pressable>
          </View>
        </View>
        <View style={styles.pickerRow}>
          <Text style={styles.label}>Проект</Text>
          <View style={styles.pickerValue}>
            {project ? (
              <View style={[styles.badge, { backgroundColor: project.color }]}>
                <Text style={styles.badgeText} numberOfLines={1}>{project.name}</Text>
              </View>
            ) : (
              <Text style={styles.hint}>Без проекта</Text>
            )}
            <Pressable accessibilityLabel="Выбрать проект" onPress={() => setProjectOpen(true)} hitSlop={8}>
              <Ionicons name="create-outline" size={20} color={theme.primary} />
            </Pressable>
          </View>
        </View>
        {project ? (
          <View style={styles.pickerRow}>
            <Text style={styles.label}>Доска</Text>
            <View style={styles.pickerValue}>
              <Text style={[styles.value, { color: theme.primary }]} numberOfLines={1}>{board?.name ?? 'Выберите доску'}</Text>
              <Pressable accessibilityLabel="Выбрать доску" onPress={() => setBoardOpen(true)} hitSlop={8}>
                <Ionicons name="create-outline" size={20} color={theme.primary} />
              </Pressable>
            </View>
          </View>
        ) : null}
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
        <Pressable onPress={() => setDateOpen((value) => !value)} style={styles.pickerRow}>
          <Text style={styles.label}>Дата</Text>
          <View style={styles.pickerValue}>
            <Text style={[styles.value, { color: date ? theme.primary : colors.inkMuted }]}>{date ? formatLongDate(date) : 'Без даты'}</Text>
            <Ionicons name="calendar-outline" size={20} color={theme.primary} />
          </View>
        </Pressable>
        {dateOpen ? (
          <View style={styles.block}>
            <MonthCalendar
              embedded
              year={selected.getFullYear()}
              month={selected.getMonth()}
              selected={date ?? ''}
              marked={new Set()}
              onSelect={setDate}
              onPrev={() => setDate(shiftMonth(calendarAnchor, -1))}
              onNext={() => setDate(shiftMonth(calendarAnchor, 1))}
            />
            {date ? (
              <Pressable
                onPress={() => {
                  setDate(null);
                  setRepeat('none');
                  setRepeatDays([]);
                }}
              >
                <Text style={[styles.hint, { color: theme.primary }]}>Убрать дату</Text>
              </Pressable>
            ) : null}
          </View>
        ) : null}
        <Pressable onPress={() => setDueOpen((value) => !value)} style={styles.pickerRow}>
          <Text style={styles.label}>Крайний срок</Text>
          <View style={styles.pickerValue}>
            <Text style={[styles.value, { color: dueDate ? theme.primary : colors.inkMuted }]}>{dueDate ? formatLongDate(dueDate) : 'Не задан'}</Text>
            <Ionicons name="calendar-outline" size={20} color={theme.primary} />
          </View>
        </Pressable>
        {dueOpen ? (
          <View style={styles.block}>
            <MonthCalendar
              embedded
              year={parseISODate(dueDate ?? calendarAnchor).getFullYear()}
              month={parseISODate(dueDate ?? calendarAnchor).getMonth()}
              selected={dueDate ?? ''}
              marked={new Set()}
              onSelect={setDueDate}
              onPrev={() => setDueDate(shiftMonth(dueDate ?? calendarAnchor, -1))}
              onNext={() => setDueDate(shiftMonth(dueDate ?? calendarAnchor, 1))}
            />
            {dueDate ? (
              <Pressable onPress={() => setDueDate(null)}>
                <Text style={[styles.hint, { color: theme.primary }]}>Убрать срок</Text>
              </Pressable>
            ) : null}
          </View>
        ) : null}
        <Flag label="Время" value={timeOn} onChange={setTimeOn} />
        {timeOn ? <TimeRow hour={hour} minute={minute} onHour={setHour} onMinute={setMinute} /> : null}
        <Flag label="Напоминание" value={reminderOn} onChange={setReminderOn} icon="notifications-outline" />
        {reminderOn ? (
          <View style={styles.block}>
            <Pressable onPress={() => setRemindOpen((value) => !value)} style={styles.pickerRow}>
              <Text style={styles.label}>Дата напоминания</Text>
              <Text style={[styles.value, { color: theme.primary }]}>{formatLongDate(remindDate)}</Text>
            </Pressable>
            {remindOpen ? (
              <MonthCalendar
                embedded
                year={reminder.getFullYear()}
                month={reminder.getMonth()}
                selected={remindDate}
                marked={new Set()}
                onSelect={setRemindDate}
                onPrev={() => setRemindDate(shiftMonth(remindDate, -1))}
                onNext={() => setRemindDate(shiftMonth(remindDate, 1))}
              />
            ) : null}
            <TimeRow hour={remindHour} minute={remindMinute} onHour={setRemindHour} onMinute={setRemindMinute} />
          </View>
        ) : null}
        {date ? <View style={styles.block}>
          <Text style={styles.label}>Повтор</Text>
          <View style={styles.wrap}>
            {REPEATS.map((item) => (
              <Chip key={item.id} label={item.label} active={repeat === item.id} onPress={() => setRepeat(item.id)} />
            ))}
          </View>
          {repeat === 'workdays' || repeat === 'weekdays' ? <Text style={styles.hint}>Понедельник–пятница</Text> : null}
          {repeat === 'custom' ? (
            <View style={styles.wrap}>
              {WEEKDAYS.map((label, index) => (
                <Chip
                  key={label}
                  label={label}
                  active={repeatDays.includes(index)}
                  onPress={() =>
                    setRepeatDays((current) =>
                      current.includes(index) ? current.filter((day) => day !== index) : [...current, index].sort(),
                    )
                  }
                />
              ))}
            </View>
          ) : null}
        </View> : null}
        <Input label="Заметка" value={note} onChangeText={setNote} placeholder="Необязательно" multiline style={styles.note} />
        <View style={styles.block}>
          <Text style={styles.label}>Файл</Text>
          {files.map((file) => (
            <View key={file.name} style={styles.step}>
              <Ionicons name="document-outline" size={18} color={colors.text} />
              <Text style={styles.stepText} numberOfLines={1}>{file.name}</Text>
              <Pressable onPress={() => setFiles((current) => current.filter((item) => item !== file))}>
                <Ionicons name="close" size={18} color={colors.textSecondary} />
              </Pressable>
            </View>
          ))}
          <Button
            title="Добавить файл"
            variant="secondary"
            onPress={() => {
              void pickAttachment().then((file) => {
                if (file) setFiles((current) => [...current, file].slice(0, 3));
              });
            }}
          />
        </View>
        <ErrorBanner message={generalError} />
      </ScrollView>
      <Modal visible={projectOpen} transparent animationType="fade" onRequestClose={() => setProjectOpen(false)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setProjectOpen(false)}>
          <Pressable style={styles.modalCard} onPress={() => undefined}>
            <Text style={styles.label}>Проект</Text>
            <Pressable onPress={() => assignProject(null)} style={styles.listOption}>
              <Text style={styles.stepText}>Без проекта</Text>
              {!project ? <Ionicons name="checkmark" size={18} color={theme.primary} /> : null}
            </Pressable>
            {projects.map((item) => (
              <Pressable key={item.id} onPress={() => assignProject(item)} style={styles.listOption}>
                <View style={[styles.badge, { backgroundColor: item.color }]}>
                  <Text style={styles.badgeText}>{item.name}</Text>
                </View>
                {project?.id === item.id ? <Ionicons name="checkmark" size={18} color={theme.primary} /> : null}
              </Pressable>
            ))}
            {projects.length === 0 ? <Text style={styles.hint}>Проектов пока нет. Создайте их в профиле.</Text> : null}
          </Pressable>
        </Pressable>
      </Modal>
      <Modal visible={boardOpen} transparent animationType="fade" onRequestClose={() => setBoardOpen(false)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setBoardOpen(false)}>
          <Pressable style={styles.modalCard} onPress={() => undefined}>
            <Text style={styles.label}>Доска</Text>
            {(project?.boards ?? []).map((item) => (
              <Pressable key={item.id} onPress={() => assignBoard(item)} style={styles.listOption}>
                <Text style={styles.stepText}>{item.name}</Text>
                {boardId === item.id ? <Ionicons name="checkmark" size={18} color={theme.primary} /> : null}
              </Pressable>
            ))}
          </Pressable>
        </Pressable>
      </Modal>
      <Modal visible={statusOpen} transparent animationType="fade" onRequestClose={() => setStatusOpen(false)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setStatusOpen(false)}>
          <Pressable style={styles.modalCard} onPress={() => undefined}>
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
          <Pressable style={styles.modalCard} onPress={() => undefined}>
            <Text style={styles.label}>Списки</Text>
            <Pressable
              onPress={() => {
                setListId(null);
                setListOpen(false);
              }}
              style={styles.listOption}
            >
              <Text style={styles.stepText}>Без списка</Text>
              {listId === null ? <Ionicons name="checkmark" size={18} color={theme.primary} /> : null}
            </Pressable>
            {lists.map((list) => (
              <Pressable
                key={list.id}
                onPress={() => {
                  setListId(list.id);
                  setListOpen(false);
                }}
                style={styles.listOption}
              >
                <View style={[styles.badge, { backgroundColor: list.color }]}>
                  <Text style={styles.badgeText}>{list.name}</Text>
                </View>
                {listId === list.id ? <Ionicons name="checkmark" size={18} color={theme.primary} /> : null}
              </Pressable>
            ))}
            {lists.length === 0 ? <Text style={styles.hint}>Списков пока нет. Создайте их в профиле.</Text> : null}
          </Pressable>
        </Pressable>
      </Modal>
      {isNew ? null : (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Удалить"
          onPress={() => void remove()}
          style={[styles.trash, { backgroundColor: colors.error, bottom: Math.max(insets.bottom, spacing.md) }]}
        >
          <Ionicons name="trash" size={22} color={colors.white} />
        </Pressable>
      )}
    </Screen>
  );
}

function Flag({ label, hint, value, onChange, icon }: { label: string; hint?: string; value: boolean; onChange: (value: boolean) => void; icon?: keyof typeof Ionicons.glyphMap }) {
  const theme = useTheme();
  return (
    <View style={styles.flag}>
      <View style={styles.flagCopy}>
        {icon ? <Ionicons name={icon} size={18} color={theme.primary} /> : null}
        <View>
          <Text style={styles.label}>{label}</Text>
          {hint ? <Text style={styles.hint}>{hint}</Text> : null}
        </View>
      </View>
      <Switch value={value} onValueChange={onChange} trackColor={{ true: theme.primary, false: colors.border }} thumbColor={colors.white} />
    </View>
  );
}

function Chip({ label, active, onPress, color }: { label: string; active: boolean; onPress: () => void; color?: string }) {
  const theme = useTheme();
  return (
    <Pressable onPress={onPress} style={[styles.chip, active && { backgroundColor: color ?? theme.primary, borderColor: color ?? theme.primary }]}>
      <Text style={[styles.chipText, active && { color: color ? colors.white : theme.onPrimary }]}>{label}</Text>
    </Pressable>
  );
}

function TimeRow({ hour, minute, onHour, onMinute }: { hour: number; minute: number; onHour: (value: number) => void; onMinute: (value: number) => void }) {
  return (
    <View style={styles.timeRow}>
      <Stepper label="Часы" value={hour} max={23} onChange={onHour} />
      <Stepper label="Минуты" value={minute} max={59} step={5} onChange={onMinute} />
    </View>
  );
}

function Stepper({ label, value, max, step = 1, onChange }: { label: string; value: number; max: number; step?: number; onChange: (value: number) => void }) {
  const cycle = (delta: number) => onChange((value + delta + max + 1) % (max + 1));
  return (
    <View style={styles.stepperBlock}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.stepper}>
        <Pressable onPress={() => cycle(-step)} style={styles.stepperBtn}><Ionicons name="remove" size={18} color={colors.text} /></Pressable>
        <Text style={styles.value}>{String(value).padStart(2, '0')}</Text>
        <Pressable onPress={() => cycle(step)} style={styles.stepperBtn}><Ionicons name="add" size={18} color={colors.text} /></Pressable>
      </View>
    </View>
  );
}

function shiftMonth(iso: string, delta: number) {
  const date = parseISODate(iso);
  const next = new Date(date.getFullYear(), date.getMonth() + delta, 1);
  const month = String(next.getMonth() + 1).padStart(2, '0');
  return `${next.getFullYear()}-${month}-01`;
}

const styles = StyleSheet.create({
  top: { paddingHorizontal: spacing.md },
  back: { flexDirection: 'row', alignItems: 'center', minHeight: 40 },
  backText: { fontSize: 16, fontWeight: '600', color: colors.text },
  scroll: { flex: 1 },
  content: { paddingHorizontal: spacing.lg, gap: spacing.md },
  heading: { fontSize: 28, fontWeight: '800', color: colors.text },
  note: { minHeight: 88, textAlignVertical: 'top', paddingTop: 14 },
  label: { fontSize: 14, fontWeight: '700', color: colors.text },
  hint: { fontSize: 13, color: colors.textSecondary },
  value: { fontSize: 16, fontWeight: '700', color: colors.text },
  block: { gap: spacing.sm },
  flag: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md },
  flagCopy: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flex: 1 },
  pickerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 44, gap: spacing.md },
  pickerValue: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flexShrink: 1 },
  badge: { borderRadius: radii.full, paddingHorizontal: 10, paddingVertical: 4, maxWidth: 180 },
  badgeText: { fontSize: 13, fontWeight: '800', color: colors.ink },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(26, 8, 48, 0.62)', justifyContent: 'flex-end' },
  modalCard: { backgroundColor: colors.surface, borderTopLeftRadius: radii.xl, borderTopRightRadius: radii.xl, padding: spacing.lg, gap: spacing.sm },
  listOption: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 44 },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: { borderRadius: radii.full, paddingHorizontal: 12, paddingVertical: 8, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  chipText: { fontSize: 13, fontWeight: '700', color: colors.ink },
  timeRow: { flexDirection: 'row', gap: spacing.md },
  stepperBlock: { flex: 1, gap: spacing.sm },
  stepper: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderWidth: 1, borderColor: colors.border, borderRadius: radii.md, minHeight: 48, paddingHorizontal: spacing.sm },
  stepperBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  step: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  stepText: { flex: 1, fontSize: 15, color: colors.text },
  stepDone: { color: colors.textSecondary, textDecorationLine: 'line-through' },
  stepAdd: { flexDirection: 'row', gap: spacing.sm },
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
