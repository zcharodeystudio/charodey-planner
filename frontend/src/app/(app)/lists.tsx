import { Ionicons } from '@expo/vector-icons';
import { Href, router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { api, type TaskListItem } from '@/api/client';
import { BackButton } from '@/components/back-button';
import { ConfirmModal } from '@/components/confirm-modal';
import { NameColorForm } from '@/components/name-color-form';
import { PageSkeleton } from '@/components/ui/skeleton';
import { Screen } from '@/components/ui/screen';
import { useAndroidBack } from '@/lib/android-back';
import { getErrorMessage } from '@/lib/errors';
import { showToast } from '@/lib/toast';
import { usePlanner } from '@/store/planner-context';
import { useTheme } from '@/store/theme-context';
import { colors, spacing } from '@/theme/theme';

export default function ListsScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const planner = usePlanner();
  const [lists, setLists] = useState<TaskListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');
  const [color, setColor] = useState('#E8B423');
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [listToDelete, setListToDelete] = useState<TaskListItem | null>(null);

  const load = useCallback(() => {
    void api
      .lists()
      .then(setLists)
      .catch((error) => showToast(getErrorMessage(error)))
      .finally(() => setLoading(false));
  }, []);

  useFocusEffect(load);

  const closeForm = () => {
    setCreating(false);
    setName('');
    setPaletteOpen(false);
  };

  const onHardwareBack = useCallback(() => {
    if (listToDelete) {
      setListToDelete(null);
      return true;
    }
    if (paletteOpen) {
      setPaletteOpen(false);
      return true;
    }
    if (!creating) return false;
    closeForm();
    return true;
  }, [creating, listToDelete, paletteOpen]);
  useAndroidBack(onHardwareBack);

  const openList = (id: string) => {
    planner.apply({ scope: 'all', listId: id });
    router.navigate('/(app)/(tabs)/today' as Href);
  };

  const createList = async () => {
    const nextName = name.trim();
    if (!nextName) return;
    try {
      const created = await api.createList({ name: nextName, color });
      setLists((current) => [...current, created]);
      closeForm();
      showToast('Список создан');
      openList(created.id);
    } catch (error) {
      showToast(getErrorMessage(error));
    }
  };

  const removeList = async (id: string) => {
    try {
      await api.deleteList(id);
      setLists((current) => current.filter((item) => item.id !== id));
      if (planner.listId === id) planner.apply({ listId: null, scope: 'all' });
      showToast('Список удалён');
    } catch (error) {
      showToast(getErrorMessage(error));
    }
  };

  if (loading && lists.length === 0) return <PageSkeleton />;

  return (
    <Screen>
      <View style={styles.top}>
        <BackButton label="Профиль" fallback="/(app)/(tabs)/profile" />
        <Text style={styles.heading}>Списки</Text>
      </View>
      <ScrollView contentContainerStyle={[styles.body, { paddingBottom: insets.bottom + spacing.xl }]} keyboardShouldPersistTaps="handled">
        {lists.map((list) => (
          <View key={list.id} style={styles.row}>
            <Pressable style={styles.main} onPress={() => openList(list.id)}>
              <View style={[styles.dot, { backgroundColor: list.color }]} />
              <Text style={styles.title}>{list.name}</Text>
              <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
            </Pressable>
            <Pressable accessibilityLabel="Удалить список" hitSlop={8} onPress={() => setListToDelete(list)}>
              <Ionicons name="trash-outline" size={18} color={colors.textSecondary} />
            </Pressable>
          </View>
        ))}
        {lists.length === 0 && !creating ? <Text style={styles.empty}>Пока нет списков.</Text> : null}
        {creating ? (
          <NameColorForm
            placeholder="Название списка"
            value={name}
            onChangeText={setName}
            color={color}
            paletteOpen={paletteOpen}
            onPaletteOpen={setPaletteOpen}
            onColor={setColor}
            onCancel={closeForm}
            onSubmit={() => void createList()}
          />
        ) : (
          <Pressable style={styles.row} onPress={() => { setCreating(true); setPaletteOpen(false); }}>
            <Text style={[styles.add, { color: theme.primary }]}>+ Список</Text>
          </Pressable>
        )}
      </ScrollView>
      <ConfirmModal
        visible={Boolean(listToDelete)}
        title="Удалить список?"
        message={listToDelete ? `Список «${listToDelete.name}» и привязка задач к нему исчезнут.` : ''}
        onClose={() => setListToDelete(null)}
        onConfirm={() => {
          const id = listToDelete?.id;
          setListToDelete(null);
          if (id) void removeList(id);
        }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  top: { paddingHorizontal: spacing.lg, paddingTop: spacing.sm, gap: spacing.xs },
  heading: { fontSize: 28, fontWeight: '800', color: colors.text },
  body: { paddingHorizontal: spacing.lg, paddingTop: spacing.md, gap: spacing.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, minHeight: 48 },
  main: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  dot: { width: 12, height: 12, borderRadius: 6 },
  title: { flex: 1, fontSize: 16, fontWeight: '700', color: colors.text },
  add: { fontSize: 16, fontWeight: '700' },
  empty: { fontSize: 15, color: colors.textSecondary },
});
