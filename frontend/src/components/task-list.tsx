import { Href, router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { api, type Task } from '@/api/client';
import { ConfirmModal } from '@/components/confirm-modal';
import { TaskCard } from '@/components/task-card';
import { Button } from '@/components/ui/button';
import { cancelTaskReminder, syncTaskReminder } from '@/lib/notifications';
import { showToast } from '@/lib/toast';
import { getErrorMessage } from '@/lib/errors';
import { colors, spacing } from '@/theme/theme';

function sortTasks(tasks: Task[]) {
  return [...tasks].sort((a, b) => {
    if (a.done !== b.done) return a.done ? 1 : -1;
    if (a.remindAt && b.remindAt) return a.remindAt.localeCompare(b.remindAt);
    if (a.remindAt) return -1;
    if (b.remindAt) return 1;
    return a.createdAt.localeCompare(b.createdAt);
  });
}

export function TaskList({ date }: { date: string }) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<Task | null>(null);

  const load = useCallback(
    async (mode: 'initial' | 'refresh' = 'initial') => {
      if (mode === 'refresh') setRefreshing(true);
      else setLoading(true);
      try {
        setTasks(sortTasks(await api.listTasks(date)));
        setError(null);
      } catch (err) {
        setError(getErrorMessage(err));
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [date],
  );

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const toggle = async (task: Task) => {
    const next = !task.done;
    setTasks((current) => sortTasks(current.map((item) => (item.id === task.id ? { ...item, done: next } : item))));
    try {
      const saved = await api.updateTask(task.id, { done: next });
      await syncTaskReminder(saved);
      setTasks((current) => sortTasks(current.map((item) => (item.id === saved.id ? saved : item))));
    } catch (err) {
      setTasks((current) => sortTasks(current.map((item) => (item.id === task.id ? task : item))));
      showToast(getErrorMessage(err));
    }
  };

  const remove = async () => {
    if (!pendingDelete) return;
    const task = pendingDelete;
    setPendingDelete(null);
    try {
      await api.deleteTask(task.id);
      await cancelTaskReminder(task.id);
      setTasks((current) => current.filter((item) => item.id !== task.id));
    } catch (err) {
      showToast(getErrorMessage(err));
    }
  };

  return (
    <View style={styles.wrap}>
      {loading && tasks.length === 0 ? (
        <ActivityIndicator color={colors.primary} style={styles.loader} />
      ) : (
        <ScrollView
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void load('refresh')} tintColor={colors.primary} />}
          showsVerticalScrollIndicator={false}
        >
          {error ? <Text style={styles.error}>{error}</Text> : null}
          {tasks.length === 0 && !error ? (
            <View style={styles.empty}>
              <Text style={styles.emptyTitle}>На этот день задач нет</Text>
              <Text style={styles.emptyText}>Создайте задачу и, если нужно, поставьте напоминание.</Text>
            </View>
          ) : null}
          {tasks.map((task, index) => (
            <View key={task.id} style={styles.row}>
              <TaskCard
                task={task}
                index={index}
                onPress={() => router.push(`/(app)/task/${task.id}` as Href)}
                onToggle={() => void toggle(task)}
              />
              <Pressable onPress={() => setPendingDelete(task)} hitSlop={8} style={styles.delete}>
                <Text style={styles.deleteText}>Удалить</Text>
              </Pressable>
            </View>
          ))}
        </ScrollView>
      )}
      <View style={styles.create}>
        <Button title="Создать задачу" onPress={() => router.push(`/(app)/task/new?date=${date}` as Href)} />
      </View>
      <ConfirmModal
        visible={pendingDelete !== null}
        title="Удалить задачу?"
        message={pendingDelete ? `«${pendingDelete.title}» исчезнет из этого дня.` : ''}
        onClose={() => setPendingDelete(null)}
        onConfirm={() => void remove()}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
  },
  list: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
    gap: spacing.sm,
  },
  row: {
    gap: 6,
  },
  loader: {
    marginTop: spacing.xl,
  },
  empty: {
    paddingVertical: spacing.xl,
    gap: spacing.sm,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.text,
  },
  emptyText: {
    fontSize: 15,
    lineHeight: 21,
    color: colors.textSecondary,
  },
  error: {
    color: colors.error,
    fontSize: 14,
  },
  delete: {
    alignSelf: 'flex-end',
    paddingRight: spacing.xs,
  },
  deleteText: {
    color: colors.error,
    fontSize: 13,
    fontWeight: '600',
  },
  create: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
  },
});
