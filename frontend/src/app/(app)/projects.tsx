import { Ionicons } from '@expo/vector-icons';
import { Href, router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { api, type ProjectItem } from '@/api/client';
import { BackButton } from '@/components/back-button';
import { ConfirmModal } from '@/components/confirm-modal';
import { NameColorForm } from '@/components/name-color-form';
import { PageSkeleton } from '@/components/ui/skeleton';
import { Screen } from '@/components/ui/screen';
import { useAndroidBack } from '@/lib/android-back';
import { getErrorMessage } from '@/lib/errors';
import { showToast } from '@/lib/toast';
import { useTheme } from '@/store/theme-context';
import { colors, spacing } from '@/theme/theme';

export default function ProjectsScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const [projects, setProjects] = useState<ProjectItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');
  const [color, setColor] = useState('#A855F7');
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [projectToDelete, setProjectToDelete] = useState<ProjectItem | null>(null);

  const load = useCallback(() => {
    void api
      .projects()
      .then(setProjects)
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
    if (projectToDelete) {
      setProjectToDelete(null);
      return true;
    }
    if (paletteOpen) {
      setPaletteOpen(false);
      return true;
    }
    if (!creating) return false;
    closeForm();
    return true;
  }, [creating, paletteOpen, projectToDelete]);
  useAndroidBack(onHardwareBack);

  const createProject = async () => {
    const nextName = name.trim();
    if (!nextName) return;
    try {
      const created = await api.createProject({ name: nextName, color });
      setProjects((current) => [...current, created]);
      closeForm();
      showToast('Проект создан');
      router.push(`/(app)/project/${created.id}` as Href);
    } catch (error) {
      showToast(getErrorMessage(error));
    }
  };

  const removeProject = async (id: string) => {
    try {
      await api.deleteProject(id);
      setProjects((current) => current.filter((item) => item.id !== id));
      showToast('Проект удалён');
    } catch (error) {
      showToast(getErrorMessage(error));
    }
  };

  if (loading && projects.length === 0) return <PageSkeleton />;

  return (
    <Screen>
      <View style={styles.top}>
        <BackButton label="Профиль" fallback="/(app)/(tabs)/profile" />
        <Text style={styles.heading}>Проекты</Text>
      </View>
      <ScrollView contentContainerStyle={[styles.body, { paddingBottom: insets.bottom + spacing.xl }]} keyboardShouldPersistTaps="handled">
        {projects.map((project) => (
          <View key={project.id} style={styles.row}>
            <Pressable style={styles.main} onPress={() => router.push(`/(app)/project/${project.id}` as Href)}>
              <View style={[styles.dot, { backgroundColor: project.color }]} />
              <Text style={styles.title}>{project.name}</Text>
              <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
            </Pressable>
            <Pressable accessibilityLabel="Удалить проект" hitSlop={8} onPress={() => setProjectToDelete(project)}>
              <Ionicons name="trash-outline" size={18} color={colors.textSecondary} />
            </Pressable>
          </View>
        ))}
        {projects.length === 0 && !creating ? <Text style={styles.empty}>Пока нет проектов.</Text> : null}
        {creating ? (
          <NameColorForm
            placeholder="Название проекта"
            value={name}
            onChangeText={setName}
            color={color}
            paletteOpen={paletteOpen}
            onPaletteOpen={setPaletteOpen}
            onColor={setColor}
            onCancel={closeForm}
            onSubmit={() => void createProject()}
          />
        ) : (
          <Pressable style={styles.row} onPress={() => { setCreating(true); setPaletteOpen(false); }}>
            <Text style={[styles.add, { color: theme.primary }]}>+ Проект</Text>
          </Pressable>
        )}
      </ScrollView>
      <ConfirmModal
        visible={Boolean(projectToDelete)}
        title="Удалить проект?"
        message={projectToDelete ? `Проект «${projectToDelete.name}» исчезнет.` : ''}
        onClose={() => setProjectToDelete(null)}
        onConfirm={() => {
          const id = projectToDelete?.id;
          setProjectToDelete(null);
          if (id) void removeProject(id);
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