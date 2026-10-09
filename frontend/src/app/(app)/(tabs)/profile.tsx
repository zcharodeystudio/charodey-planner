import { Ionicons } from '@expo/vector-icons';
import { Href, router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { useAndroidBack } from '@/lib/android-back';
import { Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { api, type NoteItem, type ProjectItem, type TaskListItem } from '@/api/client';
import { NOTE_COLORS } from '@/lib/note-colors';
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
  const [projects, setProjects] = useState<ProjectItem[]>([]);
  const [notes, setNotes] = useState<NoteItem[]>([]);
  const [creating, setCreating] = useState(false);
  const [creatingProject, setCreatingProject] = useState(false);
  const [name, setName] = useState('');
  const [projectName, setProjectName] = useState('');
  const [color, setColor] = useState(LIST_COLORS[0]);
  const [projectColor, setProjectColor] = useState(LIST_COLORS[1]);

  const loadLists = useCallback(() => {
    void api
      .lists()
      .then(setLists)
      .catch(() => undefined);
    void api
      .projects()
      .then(setProjects)
      .catch(() => undefined);
    void api
      .notes()
      .then(setNotes)
      .catch(() => undefined);
  }, []);

  useFocusEffect(loadLists);

  const onHardwareBack = useCallback(() => {
    if (creatingProject) {
      setCreatingProject(false);
      setProjectName('');
      return true;
    }
    if (!creating) return false;
    setCreating(false);
    setName('');
    return true;
  }, [creating, creatingProject]);
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
      showToast('Список создан');
      openTasks('all', created.id);
    } catch (error) {
      showToast(getErrorMessage(error));
    }
  };

  const createProject = async () => {
    const nextName = projectName.trim();
    if (!nextName) return;
    try {
      const created = await api.createProject({ name: nextName, color: projectColor });
      setProjects((current) => [...current, created]);
      setProjectName('');
      setCreatingProject(false);
      showToast('Проект создан');
      router.push(`/(app)/project/${created.id}` as Href);
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

  return (
    <Screen>
      <View style={styles.scroll}>
        <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          <Text style={styles.heading}>Профиль</Text>
          <View style={styles.card}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Выйти"
              hitSlop={8}
              onPress={() => {
                void logout().then(() => router.replace('/(auth)/welcome' as Href));
              }}
              style={styles.logout}
            >
              <Ionicons name="log-out-outline" size={22} color={colors.textSecondary} />
            </Pressable>
            <View style={[styles.avatar, { backgroundColor: theme.primaryMuted }]}>
              <Text style={[styles.initial, { color: theme.primaryPressed }]}>{initial}</Text>
            </View>
            <Text style={styles.name}>{user?.name}</Text>
            <Text style={styles.email}>{user?.email}</Text>
          </View>

          <Mode icon="checkbox-outline" title="Все задачи" active={planner.scope === 'all' && !planner.listId} onPress={() => openTasks('all', null)} />

          <View style={styles.group}>
            {lists.length > 0 ? <Text style={styles.section}>Списки</Text> : null}
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
                <Text style={[styles.linkTitle, { color: theme.primary }]}>+ Список</Text>
              </Pressable>
            )}
          </View>

          <View style={styles.group}>
            {projects.length > 0 ? <Text style={styles.section}>Проекты</Text> : null}
            {projects.map((project) => (
              <View key={project.id} style={styles.link}>
                <Pressable style={styles.linkMain} onPress={() => router.push(`/(app)/project/${project.id}` as Href)}>
                  <View style={[styles.dot, { backgroundColor: project.color }]} />
                  <Text style={styles.modeTitle}>{project.name}</Text>
                  <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
                </Pressable>
                <Pressable
                  accessibilityLabel="Удалить проект"
                  hitSlop={8}
                  onPress={() => {
                    void api
                      .deleteProject(project.id)
                      .then(() => {
                        setProjects((current) => current.filter((item) => item.id !== project.id));
                        showToast('Проект удалён');
                      })
                      .catch((error) => showToast(getErrorMessage(error)));
                  }}
                >
                  <Ionicons name="trash-outline" size={18} color={colors.textSecondary} />
                </Pressable>
              </View>
            ))}
            {creatingProject ? (
              <View style={styles.create}>
                <TextInput value={projectName} onChangeText={setProjectName} onSubmitEditing={() => void createProject()} placeholder="Название проекта" placeholderTextColor={colors.inkMuted} style={styles.input} />
                <View style={styles.colors}>
                  {LIST_COLORS.map((item) => (
                    <Pressable key={item} onPress={() => setProjectColor(item)} style={[styles.color, { backgroundColor: item }, projectColor === item && styles.colorOn]} />
                  ))}
                </View>
                <Button title="Создать проект" onPress={() => void createProject()} />
              </View>
            ) : (
              <Pressable style={styles.link} onPress={() => setCreatingProject(true)}>
                <Text style={[styles.linkTitle, { color: theme.primary }]}>+ Проект</Text>
              </Pressable>
            )}
          </View>

          <View style={styles.group}>
            {notes.length > 0 ? <Text style={styles.section}>Заметки</Text> : null}
            {notes.map((note) => (
              <View key={note.id} style={styles.link}>
                <Pressable style={styles.linkMain} onPress={() => router.push(`/(app)/note/${note.id}` as Href)}>
                  <View style={[styles.dot, { backgroundColor: note.color }]} />
                  <Text style={styles.modeTitle} numberOfLines={1}>
                    {note.title.trim() || 'Без названия'}
                  </Text>
                  {note.pinned ? <Ionicons name="pin" size={16} color={colors.textSecondary} /> : null}
                </Pressable>
                <Pressable
                  accessibilityLabel="Удалить заметку"
                  hitSlop={8}
                  onPress={() => {
                    void api
                      .deleteNote(note.id)
                      .then(() => {
                        setNotes((current) => current.filter((item) => item.id !== note.id));
                        showToast('Заметка удалена');
                      })
                      .catch((error) => showToast(getErrorMessage(error)));
                  }}
                >
                  <Ionicons name="trash-outline" size={18} color={colors.textSecondary} />
                </Pressable>
              </View>
            ))}
            <Pressable
              style={styles.link}
              onPress={() => {
                void api
                  .createNote({ color: NOTE_COLORS[0] })
                  .then((created) => router.push(`/(app)/note/${created.id}` as Href))
                  .catch((error) => showToast(getErrorMessage(error)));
              }}
            >
              <Text style={[styles.linkTitle, { color: theme.primary }]}>+ Заметка</Text>
            </Pressable>
          </View>
          <Text style={styles.section}>Настройки</Text>
          <View style={styles.settings}>
            <Setting icon="arrow-up" title="Новые задачи сверху" hint="Выключено: в течение дня задачи идут по времени, с раннего к позднему" value={planner.newOnTop} onChange={planner.setNewOnTop} />
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
  scroll: { flex: 1 },
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
  logout: { position: 'absolute', top: spacing.sm, right: spacing.sm, width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
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
  group: { gap: spacing.sm, marginTop: spacing.sm },
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
});
