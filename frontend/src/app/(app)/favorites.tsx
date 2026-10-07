import { Ionicons } from '@expo/vector-icons';
import { Href, router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { api, type Task } from '@/api/client';
import { SwipeToDelete } from '@/components/swipe-to-delete';
import { TaskCard } from '@/components/task-card';
import { Screen } from '@/components/ui/screen';
import { useTheme } from '@/store/theme-context';
import { getErrorMessage } from '@/lib/errors';
import { cancelTaskReminder, syncTaskReminder } from '@/lib/notifications';
import { showToast } from '@/lib/toast';
import { colors, spacing } from '@/theme/theme';

export default function FavoritesScreen() {
  const theme = useTheme();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const next = await api.favorites();
      setTasks(next.map((task) => ({ ...task, favorite: true, position: task.position ?? 0 })));
    } catch (error) {
      showToast(getErrorMessage(error));
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const toggle = async (task: Task) => {
    const next = !task.done;
    setTasks((current) => current.map((item) => (item.id === task.id ? { ...item, done: next } : item)));
    try {
      const saved = await api.updateTask(task.id, { done: next });
      await syncTaskReminder(saved);
    } catch (error) {
      setTasks((current) => current.map((item) => (item.id === task.id ? task : item)));
      showToast(getErrorMessage(error));
    }
  };

  const toggleStep = async (task: Task, stepId: string) => {
    const steps = (task.steps ?? []).map((step) => (step.id === stepId ? { ...step, done: !step.done } : step));
    setTasks((current) => current.map((item) => (item.id === task.id ? { ...item, steps } : item)));
    try {
      await api.updateTask(task.id, { steps });
    } catch (error) {
      setTasks((current) => current.map((item) => (item.id === task.id ? task : item)));
      showToast(getErrorMessage(error));
    }
  };

  const toggleImportant = async (task: Task) => {
    const next = !task.important;
    setTasks((current) => current.map((item) => (item.id === task.id ? { ...item, important: next } : item)));
    try {
      await api.updateTask(task.id, { important: next });
    } catch (error) {
      setTasks((current) => current.map((item) => (item.id === task.id ? task : item)));
      showToast(getErrorMessage(error));
    }
  };

  const unfavorite = async (task: Task) => {
    setTasks((current) => current.filter((item) => item.id !== task.id));
    try {
      await api.updateTask(task.id, { favorite: false });
    } catch (error) {
      setTasks((current) => [task, ...current]);
      showToast(getErrorMessage(error));
    }
  };

  const remove = async (task: Task) => {
    setTasks((current) => current.filter((item) => item.id !== task.id));
    try {
      await api.deleteTask(task.id);
      await cancelTaskReminder(task.id);
    } catch (error) {
      setTasks((current) => [task, ...current]);
      showToast(getErrorMessage(error));
    }
  };

  return (
    <Screen>
      <View style={styles.top}>
        <Pressable onPress={() => router.back()} hitSlop={12} style={styles.back}>
          <Ionicons name="chevron-back" size={26} color={colors.text} />
          <Text style={styles.backText}>Назад</Text>
        </Pressable>
      </View>
      <Text style={styles.heading}>Избранное</Text>
      {loading ? (
        <ActivityIndicator color={theme.primary} style={styles.loader} />
      ) : (
        <ScrollView contentContainerStyle={styles.list} showsVerticalScrollIndicator={false}>
          {tasks.length === 0 ? (
            <View style={styles.empty}>
              <Text style={styles.emptyTitle}>Пока пусто</Text>
              <Text style={styles.emptyText}>Нажмите звёздочку на задаче, и она появится здесь.</Text>
            </View>
          ) : null}
          {tasks.map((task, index) => (
            <SwipeToDelete key={task.id} onDelete={() => void remove(task)}>
              <TaskCard
                task={task}
                index={index}
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
  back: { flexDirection: 'row', alignItems: 'center', minHeight: 40 },
  backText: { fontSize: 16, fontWeight: '600', color: colors.text },
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
