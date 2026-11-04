import { Href, router, useFocusEffect } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { api, type Task } from '@/api/client';
import { peekTasksCache, readTasksCache, sameTasks, writeTasksCache } from '@/lib/planner-cache';
import { useAuth } from '@/store/auth-context';
import { SwipeToDelete } from '@/components/swipe-to-delete';
import { TaskCard } from '@/components/task-card';
import { BackButton, goBack } from '@/components/back-button';
import { useAndroidBack } from '@/lib/android-back';
import { Screen } from '@/components/ui/screen';
import { useTheme } from '@/store/theme-context';
import { getErrorMessage } from '@/lib/errors';
import { completeTask, skipOccurrence } from '@/lib/recurrence';
import { cancelTaskReminder, syncTaskReminder } from '@/lib/notifications';
import { showToast } from '@/lib/toast';
import { colors, spacing } from '@/theme/theme';

export default function FavoritesScreen() {
  const theme = useTheme();
  const { user } = useAuth();
  const stored = user?.id ? peekTasksCache(user.id, 'favorites') : null;
  const [tasks, setTasks] = useState<Task[]>(() => stored?.tasks ?? []);
  const [loading, setLoading] = useState(!stored);
  const localRev = useRef(0);
  const tasksRef = useRef(tasks);
  tasksRef.current = tasks;

  const keep = (next: Task[]) => {
    setTasks((current) => (sameTasks(current, next) ? current : next));
  };

  const load = useCallback(async () => {
    const revision = localRev.current;
    let showed = tasksRef.current.length > 0;
    if (user?.id) {
      const cached = peekTasksCache(user.id, 'favorites') ?? (await readTasksCache(user.id, 'favorites'));
      if (localRev.current !== revision) return;
      if (cached) {
        showed = true;
        keep(cached.tasks);
        setLoading(false);
      }
    }
    try {
      const next = (await api.favorites()).map((task) => ({ ...task, favorite: true, position: task.position ?? 0 }));
      if (localRev.current !== revision) return;
      keep(next);
      if (user?.id && localRev.current === revision) void writeTasksCache(user.id, 'favorites', next, []);
    } catch (error) {
      if (!showed) showToast(getErrorMessage(error));
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );
  useAndroidBack(() => {
    goBack('/(app)/(tabs)/today');
    return true;
  });

  const publish = (update: (current: Task[]) => Task[]) => {
    localRev.current += 1;
    const next = update(tasksRef.current);
    tasksRef.current = next;
    setTasks(next);
    if (user?.id) writeTasksCache(user.id, 'favorites', next, []);
  };

  const toggle = async (task: Task) => {
    const next = !task.done;
    publish((current) => current.map((item) => (item.id === task.id ? { ...item, done: next } : item)));
    try {
      if (next && task.repeat && task.repeat !== 'none') {
        const result = await completeTask(task);
        publish((current) => {
          const replaced = current.map((item) => (item.id === result.done.id ? result.done : item));
          return result.spawned ? [result.spawned, ...replaced] : replaced;
        });
        return;
      }
      const saved = await api.updateTask(task.id, { done: next });
      await syncTaskReminder(saved);
    } catch (error) {
      publish((current) => current.map((item) => (item.id === task.id ? task : item)));
      showToast(getErrorMessage(error));
    }
  };

  const toggleStep = async (task: Task, stepId: string) => {
    const steps = (task.steps ?? []).map((step) => (step.id === stepId ? { ...step, done: !step.done } : step));
    publish((current) => current.map((item) => (item.id === task.id ? { ...item, steps } : item)));
    try {
      await api.updateTask(task.id, { steps });
    } catch (error) {
      publish((current) => current.map((item) => (item.id === task.id ? task : item)));
      showToast(getErrorMessage(error));
    }
  };

  const toggleImportant = async (task: Task) => {
    const next = !task.important;
    publish((current) => current.map((item) => (item.id === task.id ? { ...item, important: next } : item)));
    try {
      await api.updateTask(task.id, { important: next });
    } catch (error) {
      publish((current) => current.map((item) => (item.id === task.id ? task : item)));
      showToast(getErrorMessage(error));
    }
  };

  const unfavorite = async (task: Task) => {
    publish((current) => current.filter((item) => item.id !== task.id));
    try {
      await api.updateTask(task.id, { favorite: false });
    } catch (error) {
      publish((current) => [task, ...current]);
      showToast(getErrorMessage(error));
    }
  };

  const remove = async (task: Task) => {
    try {
      const skipped = await skipOccurrence(task);
      if (skipped) {
        publish((current) => current.map((item) => (item.id === task.id ? skipped : item)));
        showToast('Этот день пропущен');
        return;
      }
      publish((current) => current.filter((item) => item.id !== task.id));
      await api.deleteTask(task.id);
      await cancelTaskReminder(task.id);
    } catch (error) {
      showToast(getErrorMessage(error));
    }
  };

  return (
    <Screen>
      <View style={styles.top}>
        <BackButton label="Назад" fallback="/(app)/(tabs)/today" />
      </View>
      <Text style={styles.heading}>Избранное</Text>
      {loading && tasks.length === 0 ? (
        <ActivityIndicator color={theme.primary} style={styles.loader} />
      ) : (
        <ScrollView contentContainerStyle={styles.list} showsVerticalScrollIndicator={false}>
          {tasks.length === 0 ? (
            <View style={styles.empty}>
              <Text style={styles.emptyTitle}>Пока пусто</Text>
              <Text style={styles.emptyText}>Нажмите звёздочку на задаче, и она появится здесь.</Text>
            </View>
          ) : null}
          {tasks.map((task) => (
            <SwipeToDelete key={task.id} onDelete={() => void remove(task)}>
              <TaskCard
                task={task}
                onPress={() => router.push(`/(app)/task/${task.id}` as Href)}
                onToggle={() => void toggle(task)}
                onFavorite={() => void unfavorite(task)}
                onImportant={() => void toggleImportant(task)}
                onToggleStep={(stepId) => void toggleStep(task, stepId)}
              />
            </SwipeToDelete>
          ))}
        </ScrollView>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  top: { paddingHorizontal: spacing.md },
  heading: {
    fontSize: 28,
    fontWeight: '800',
    color: colors.text,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
  },
  loader: { marginTop: spacing.xl },
  list: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xl, gap: spacing.sm },
  empty: { paddingVertical: spacing.xl, gap: spacing.sm },
  emptyTitle: { fontSize: 18, fontWeight: '800', color: colors.text },
  emptyText: { fontSize: 15, lineHeight: 21, color: colors.textSecondary },
});
