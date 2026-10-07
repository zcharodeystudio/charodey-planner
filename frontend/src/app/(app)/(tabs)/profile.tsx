import { Ionicons } from '@expo/vector-icons';
import { Href, router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { useAndroidBack } from '@/lib/android-back';
import { Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { api, type TaskListItem } from '@/api/client';
import { Button } from '@/components/ui/button';
import { Screen } from '@/components/ui/screen';
import { getErrorMessage } from '@/lib/errors';
import { showToast } from '@/lib/toast';
import { useAuth } from '@/store/auth-context';
import { usePlanner, type TaskScope } from '@/store/planner-context';
import { ACCENTS, useTheme } from '@/store/theme-context';
import { colors, radii, spacing } from '@/theme/theme';

const LIST_COLORS = ['#E8B423', '#A855F7', '#60A5FA', '#F59E0B', '#F472B6'];

export default function ProfileScreen() {
  const theme = useTheme();
  const planner = usePlanner();
  const { user, logout } = useAuth();
  const initial = user?.name.trim().charAt(0).toUpperCase() || '?';
  const [lists, setLists] = useState<TaskListItem[]>([]);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');
  const [color, setColor] = useState(LIST_COLORS[0]);

  const loadLists = useCallback(() => {
    void api
      .lists()
      .then(setLists)
      .catch(() => undefined);
  }, []);

  useFocusEffect(loadLists);

  const onHardwareBack = useCallback(() => {
    if (!creating) return false;
    setCreating(false);
    setName('');
    return true;
  }, [creating]);
  useAndroidBack(onHardwareBack);

  const openTasks = (scope: TaskScope, listId: string | null) => {
    planner.apply({ scope, listId });
    router.navigate('/(app)/(tabs)/today' as Href);
  };

  const createList = async () => {
    const nextName = name.trim();
    if (!nextName) return;
    try {
      const created = await api.createList({ name: nextName, color });
      setLists((current) => [...current, created]);
      setName('');
      setCreating(false);
      openTasks('all', created.id);
    } catch (error) {
      showToast(getErrorMessage(error));
    }
  };

  const removeList = async (id: string) => {
    try {
      await api.deleteList(id);
      setLists((current) => current.filter((item) => item.id !== id));
      if (planner.listId === id) planner.apply({ listId: null, scope: 'all' });
    } catch (error) {
      showToast(getErrorMessage(error));
    }
  };

  return (
    <Screen>
      <View style={styles.scroll}>
        <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          <Text style={styles.heading}>Профиль</Text>
          <View style={styles.card}>
            <View style={[styles.avatar, { backgroundColor: theme.primaryMuted }]}>
              <Text style={[styles.initial, { color: theme.primaryPressed }]}>{initial}</Text>
            </View>
            <Text style={styles.name}>{user?.name}</Text>
            <Text style={styles.email}>{user?.email}</Text>
          </View>

          <Text style={styles.section}>Задачи</Text>
          <Mode icon="checkbox-outline" title="Все задачи" active={planner.scope === 'all' && !planner.listId} onPress={() => openTasks('all', null)} />
          <Mode icon="star" title="Избранное" active={planner.scope === 'favorites'} onPress={() => openTasks('favorites', null)} />
          <Mode icon="flag" title="Просроченные" active={planner.scope === 'overdue'} onPress={() => openTasks('overdue', null)} />
          <Mode icon="time-outline" title="Без времени" active={planner.scope === 'untimed'} onPress={() => openTasks('untimed', null)} />

          <Text style={styles.section}>Списки</Text>
          {lists.map((list) => {
            const active = planner.scope === 'all' && planner.listId === list.id;
            return (
              <View key={list.id} style={styles.link}>
                <Pressable style={styles.linkMain} onPress={() => openTasks('all', list.id)}>
                  <View style={[styles.dot, { backgroundColor: list.color }]} />
      <Text style={[styles.modeTitle, active && { color: theme.primary }]}>{list.name}</Text>
                  {active ? <Ionicons name="checkmark" size={18} color={theme.primary} /> : null}
                </Pressable>
                <Pressable accessibilityLabel="Удалить список" hitSlop={8} onPress={() => void removeList(list.id)}>
                  <Ionicons name="trash-outline" size={18} color={colors.textSecondary} />
                </Pressable>
              </View>
            );
          })}
          {creating ? (
            <View style={styles.create}>
              <TextInput value={name} onChangeText={setName} onSubmitEditing={() => void createList()} placeholder="Название списка" placeholderTextColor={colors.inkMuted} style={styles.input} />
              <View style={styles.colors}>
                {LIST_COLORS.map((item) => (
                  <Pressable key={item} onPress={() => setColor(item)} style={[styles.color, { backgroundColor: item }, color === item && styles.colorOn]} />
                ))}
              </View>
              <Button title="Создать" onPress={() => void createList()} />
            </View>
          ) : (
            <Pressable style={styles.link} onPress={() => setCreating(true)}>
              <Ionicons name="add" size={20} color={theme.primary} />
            <Text style={styles.linkTitle}>Новый список</Text>
            </Pressable>
          )}

          <Text style={styles.section}>Настройки</Text>
          <View style={styles.settings}>
            <Setting icon="arrow-up" title="Новые задачи сверху" hint="Созданная задача встаёт в начало списка" value={planner.newOnTop} onChange={planner.setNewOnTop} />
            <Setting icon="swap-vertical" title="Перемещение" hint="Стрелки на карточке меняют порядок" value={planner.reorder} onChange={planner.setReorder} />
          </View>
          <Text style={styles.section}>Цвет</Text>
          <View style={styles.colors}>
            {ACCENTS.map((accent) => (
              <Pressable
                key={accent.id}
                accessibilityLabel={accent.label}
                onPress={() => theme.setAccentId(accent.id)}
                style={[styles.color, { backgroundColor: accent.primary }, theme.accentId === accent.id && styles.colorOn]}
              />
            ))}
          </View>
        </ScrollView>
      </View>
      <View style={styles.logout}>
        <Button
          title="Выйти"
          variant="secondary"
          onPress={() => {
            void logout().then(() => router.replace('/(auth)/welcome' as Href));
          }}
        />
      </View>
    </Screen>
  );
}

function Mode({ icon, title, active, onPress }: { icon: keyof typeof Ionicons.glyphMap; title: string; active: boolean; onPress: () => void }) {
  const theme = useTheme();
  return (
    <Pressable style={styles.link} onPress={onPress}>
      <Ionicons name={icon} size={20} color={active ? theme.primary : colors.textSecondary} />
      <Text style={[styles.modeTitle, active && { color: theme.primary }]}>{title}</Text>
      <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
    </Pressable>
  );
}

function Setting({
  icon,
  title,
  hint,
  value,
  onChange,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  hint: string;
  value: boolean;
  onChange: (value: boolean) => void;
}) {
  const theme = useTheme();
  return (
    <View style={styles.setting}>
      <Ionicons name={icon} size={20} color={theme.primary} />
      <View style={styles.linkCopy}>
        <Text style={styles.linkTitle}>{title}</Text>
        <Text style={styles.hint}>{hint}</Text>
      </View>
      <Switch value={value} onValueChange={onChange} trackColor={{ true: theme.primary, false: colors.border }} thumbColor={colors.white} />
    </View>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, marginBottom: 72 },
  heading: {
    fontSize: 28,
    fontWeight: '800',
    color: colors.text,
    paddingTop: spacing.sm,
  },
  body: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.lg,
    gap: spacing.sm,
  },
  card: {
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.lg,
    borderRadius: radii.xl,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.sm,
  },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: radii.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  initial: { fontSize: 28, fontWeight: '800' },
  name: { fontSize: 20, fontWeight: '800', color: colors.ink },
  email: { fontSize: 15, color: colors.inkMuted },
  section: { fontSize: 14, fontWeight: '800', color: colors.textSecondary, marginTop: spacing.sm },
  settings: { gap: spacing.md },
  setting: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  link: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, minHeight: 48 },
  linkMain: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  linkCopy: { flex: 1, gap: 2 },
  linkTitle: { fontSize: 16, fontWeight: '700', color: colors.text },
  modeTitle: { flex: 1, fontSize: 16, fontWeight: '700', color: colors.text },
  hint: { fontSize: 13, lineHeight: 18, color: colors.textSecondary },
  dot: { width: 12, height: 12, borderRadius: 6 },
  create: { gap: spacing.sm },
  input: {
    minHeight: 48,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    color: colors.ink,
    backgroundColor: colors.surface,
  },
  colors: { flexDirection: 'row', gap: spacing.sm, paddingVertical: spacing.xs },
  color: { width: 32, height: 32, borderRadius: 16 },
  colorOn: { borderWidth: 3, borderColor: colors.text },
  logout: { position: 'absolute', left: spacing.lg, right: spacing.lg, bottom: spacing.sm },
});
