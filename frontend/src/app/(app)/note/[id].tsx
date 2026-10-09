import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { api } from '@/api/client';
import { ConfirmModal } from '@/components/confirm-modal';
import { Screen, ScreenLoader } from '@/components/ui/screen';
import { useAndroidBack } from '@/lib/android-back';
import { getErrorMessage } from '@/lib/errors';
import { NOTE_COLORS } from '@/lib/note-colors';
import { showToast } from '@/lib/toast';
import { colors, radii, spacing } from '@/theme/theme';

type Draft = { title: string; body: string; color: string; pinned: boolean };

export default function NoteScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [confirm, setConfirm] = useState(false);
  const draftRef = useRef<Draft | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const leaving = useRef(false);

  useEffect(() => {
    if (!id) return;
    void api
      .getNote(id)
      .then((note) => {
        const next = { title: note.title, body: note.body, color: note.color, pinned: note.pinned };
        draftRef.current = next;
        setDraft(next);
      })
      .catch((error) => {
        showToast(getErrorMessage(error));
        router.back();
      });
  }, [id]);

  const saveNow = async (next: Draft) => {
    if (!id) return;
    await api.updateNote(id, next);
  };

  const schedule = (next: Draft) => {
    draftRef.current = next;
    setDraft(next);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      void saveNow(next).catch((error) => showToast(getErrorMessage(error)));
    }, 400);
  };

  const leave = async () => {
    if (leaving.current || !id) return;
    leaving.current = true;
    if (timer.current) clearTimeout(timer.current);
    const next = draftRef.current;
    try {
      if (next && !next.title.trim() && !next.body.trim()) await api.deleteNote(id);
      else if (next) await saveNow(next);
    } catch (error) {
      showToast(getErrorMessage(error));
    }
    router.back();
  };

  useAndroidBack(() => {
    void leave();
    return true;
  });

  const remove = async () => {
    if (!id) return;
    leaving.current = true;
    if (timer.current) clearTimeout(timer.current);
    try {
      await api.deleteNote(id);
      showToast('Заметка удалена');
      router.back();
    } catch (error) {
      leaving.current = false;
      showToast(getErrorMessage(error));
    }
  };

  if (!draft) return <ScreenLoader />;

  return (
    <Screen>
      <View style={[styles.page, { backgroundColor: draft.color }]}>
        <View style={styles.top}>
          <Pressable accessibilityLabel="Назад" onPress={() => void leave()} hitSlop={12} style={styles.back}>
            <Ionicons name="chevron-back" size={26} color={colors.text} />
            <Text style={styles.backText}>Заметки</Text>
          </Pressable>
          <View style={styles.actions}>
            <Pressable
              accessibilityLabel={draft.pinned ? 'Открепить' : 'Закрепить'}
              hitSlop={8}
              onPress={() => schedule({ ...draft, pinned: !draft.pinned })}
            >
              <Ionicons name={draft.pinned ? 'pin' : 'pin-outline'} size={22} color={colors.ink} />
            </Pressable>
            <Pressable accessibilityLabel="Удалить" hitSlop={8} onPress={() => setConfirm(true)}>
              <Ionicons name="trash-outline" size={22} color={colors.ink} />
            </Pressable>
          </View>
        </View>
        <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
          <TextInput
            value={draft.title}
            onChangeText={(title) => schedule({ ...draft, title })}
            placeholder="Заголовок"
            placeholderTextColor={colors.inkMuted}
            style={styles.title}
          />
          <TextInput
            value={draft.body}
            onChangeText={(body) => schedule({ ...draft, body })}
            placeholder="Текст заметки"
            placeholderTextColor={colors.inkMuted}
            style={styles.bodyInput}
            multiline
            textAlignVertical="top"
          />
          <View style={styles.colors}>
            {NOTE_COLORS.map((color) => (
              <Pressable
                key={color}
                accessibilityLabel="Цвет"
                onPress={() => schedule({ ...draft, color })}
                style={[styles.color, { backgroundColor: color }, draft.color === color && styles.colorOn]}
              />
            ))}
          </View>
        </ScrollView>
      </View>
      <ConfirmModal
        visible={confirm}
        title="Удалить заметку?"
        message="Заметку нельзя будет вернуть."
        onClose={() => setConfirm(false)}
        onConfirm={() => {
          setConfirm(false);
          void remove();
        }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1 },
  top: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
  },
  back: { flexDirection: 'row', alignItems: 'center' },
  backText: { fontSize: 16, fontWeight: '700', color: colors.text },
  actions: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  body: { paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: spacing.xl, gap: spacing.md },
  title: { fontSize: 24, fontWeight: '800', color: colors.ink, padding: 0 },
  bodyInput: { minHeight: 220, fontSize: 16, lineHeight: 24, color: colors.ink, padding: 0 },
  colors: { flexDirection: 'row', gap: spacing.sm, paddingTop: spacing.sm },
  color: { width: 32, height: 32, borderRadius: 16, borderWidth: 1, borderColor: colors.border },
  colorOn: { borderWidth: 3, borderColor: colors.text },
});
