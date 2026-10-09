import { Ionicons } from '@expo/vector-icons';
import { Href, router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { api, type NoteItem } from '@/api/client';
import { Screen, ScreenLoader } from '@/components/ui/screen';
import { getErrorMessage } from '@/lib/errors';
import { NOTE_COLORS } from '@/lib/note-colors';
import { showToast } from '@/lib/toast';
import { useTheme } from '@/store/theme-context';
import { colors, radii, spacing } from '@/theme/theme';

export default function NotesScreen() {
  const theme = useTheme();
  const [notes, setNotes] = useState<NoteItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);

  const load = useCallback(() => {
    void api
      .notes()
      .then(setNotes)
      .catch((error) => showToast(getErrorMessage(error)))
      .finally(() => setLoading(false));
  }, []);

  useFocusEffect(load);

  const create = async () => {
    if (creating) return;
    setCreating(true);
    try {
      const created = await api.createNote({ color: NOTE_COLORS[0] });
      router.push(`/(app)/note/${created.id}` as Href);
    } catch (error) {
      showToast(getErrorMessage(error));
    } finally {
      setCreating(false);
    }
  };

  const togglePin = async (note: NoteItem) => {
    const pinned = !note.pinned;
    setNotes((current) =>
      current
        .map((item) => (item.id === note.id ? { ...item, pinned } : item))
        .sort((a, b) => Number(b.pinned) - Number(a.pinned) || b.updatedAt.localeCompare(a.updatedAt)),
    );
    try {
      await api.updateNote(note.id, { pinned });
    } catch (error) {
      showToast(getErrorMessage(error));
      load();
    }
  };

  if (loading && notes.length === 0) return <ScreenLoader />;

  return (
    <Screen>
      <View style={styles.top}>
        <Pressable accessibilityLabel="Назад" onPress={() => router.back()} hitSlop={12} style={styles.back}>
          <Ionicons name="chevron-back" size={26} color={colors.text} />
          <Text style={styles.backText}>Профиль</Text>
        </Pressable>
        <Text style={styles.heading}>Заметки</Text>
      </View>
      <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
        <Pressable style={[styles.composer, { borderColor: theme.primary }]} onPress={() => void create()} disabled={creating}>
          <Ionicons name="add" size={22} color={theme.primary} />
          <Text style={[styles.composerText, { color: theme.primary }]}>Новая заметка</Text>
        </Pressable>
        {notes.length === 0 ? <Text style={styles.empty}>Пока пусто. Напишите первую заметку.</Text> : null}
        <View style={styles.grid}>
          {[0, 1].map((column) => (
            <View key={column} style={styles.column}>
              {notes
                .filter((_, index) => index % 2 === column)
                .map((note) => (
                  <Pressable key={note.id} style={[styles.card, { backgroundColor: note.color }]} onPress={() => router.push(`/(app)/note/${note.id}` as Href)}>
                    <View style={styles.cardTop}>
                      <Text style={styles.cardTitle} numberOfLines={3}>
                        {note.title.trim() || 'Без названия'}
                      </Text>
                      <Pressable accessibilityLabel={note.pinned ? 'Открепить' : 'Закрепить'} hitSlop={8} onPress={() => void togglePin(note)}>
                        <Ionicons name={note.pinned ? 'pin' : 'pin-outline'} size={16} color={colors.inkMuted} />
                      </Pressable>
                    </View>
                    {note.body.trim() ? (
                      <Text style={styles.cardBody} numberOfLines={8}>
                        {note.body}
                      </Text>
                    ) : null}
                  </Pressable>
                ))}
            </View>
          ))}
        </View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  top: { paddingHorizontal: spacing.lg, paddingTop: spacing.sm, gap: spacing.xs },
  back: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start' },
  backText: { fontSize: 16, fontWeight: '700', color: colors.text },
  heading: { fontSize: 28, fontWeight: '800', color: colors.text },
  body: { paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: spacing.xl, gap: spacing.md },
  composer: {
    minHeight: 52,
    borderRadius: radii.lg,
    borderWidth: 1,
    backgroundColor: colors.surface,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  composerText: { fontSize: 16, fontWeight: '700' },
  empty: { fontSize: 15, color: colors.textSecondary },
  grid: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  column: { flex: 1, gap: spacing.sm },
  card: {
    minHeight: 96,
    borderRadius: radii.lg,
    padding: spacing.md,
    gap: spacing.xs,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardTop: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.xs },
  cardTitle: { flex: 1, fontSize: 16, fontWeight: '800', color: colors.ink },
  cardBody: { fontSize: 14, lineHeight: 20, color: colors.ink },
});
