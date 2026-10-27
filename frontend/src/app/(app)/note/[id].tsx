import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { api, type NoteBlock } from '@/api/client';
import { goBack } from '@/components/back-button';
import { ConfirmModal } from '@/components/confirm-modal';
import { PageSkeleton } from '@/components/ui/skeleton';
import { Screen } from '@/components/ui/screen';
import { useAndroidBack } from '@/lib/android-back';
import { getErrorMessage } from '@/lib/errors';
import { NOTE_COLORS } from '@/lib/note-colors';
import { showToast } from '@/lib/toast';
import { useTheme } from '@/store/theme-context';
import { colors, radii, spacing } from '@/theme/theme';

type Draft = { title: string; color: string; pinned: boolean; blocks: NoteBlock[] };

const ADDITIONS: { type: NoteBlock['type']; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { type: 'text', label: 'Текст', icon: 'document-text-outline' },
  { type: 'heading', label: 'Заголовок', icon: 'text-outline' },
  { type: 'bullet', label: 'Маркированный список', icon: 'list' },
  { type: 'number', label: 'Нумерованный список', icon: 'list-outline' },
  { type: 'todo', label: 'Туду-лист', icon: 'checkbox-outline' },
  { type: 'table', label: 'Таблица', icon: 'grid-outline' },
  { type: 'divider', label: 'Разделитель', icon: 'remove-outline' },
];

const blockId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

function emptyBlock(type: NoteBlock['type']): NoteBlock {
  if (type === 'table') return { id: blockId(), type, text: '', items: [], columns: ['', ''], rows: [['', '']] };
  if (type === 'bullet' || type === 'number' || type === 'todo') return { id: blockId(), type, text: '', items: [{ id: blockId(), text: '', done: false }], columns: [], rows: [] };
  return { id: blockId(), type, text: '', items: [], columns: [], rows: [] };
}

function preview(blocks: NoteBlock[]) {
  return blocks
    .map((block) => {
      if (block.type === 'table') return block.rows.map((row) => row.join(' ')).join('\n');
      if (block.items.length) return block.items.map((item) => item.text).filter(Boolean).join('\n');
      return block.text;
    })
    .filter(Boolean)
    .join('\n')
    .slice(0, 4000);
}

function hasContent(draft: Draft) {
  return Boolean(draft.title.trim() || preview(draft.blocks).trim());
}

export default function NoteScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [confirm, setConfirm] = useState(false);
  const [menu, setMenu] = useState(false);
  const [focusId, setFocusId] = useState<string | null>(null);
  const draftRef = useRef<Draft | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const leaving = useRef(false);

  useEffect(() => {
    if (!id) return;
    void api
      .getNote(id)
      .then((note) => {
        const blocks = note.blocks?.length
          ? note.blocks
          : note.body.trim()
            ? [{ id: 'body', type: 'text' as const, text: note.body, items: [], columns: [], rows: [] }]
            : [];
        const next = { title: note.title, color: note.color, pinned: note.pinned, blocks };
        draftRef.current = next;
        setDraft(next);
      })
      .catch((error) => {
        showToast(getErrorMessage(error));
        goBack('/(app)/notes');
      });
  }, [id]);

  const saveNow = async (next: Draft) => {
    if (!id) return;
    await api.updateNote(id, { ...next, body: preview(next.blocks), blocks: next.blocks });
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
      if (next && !hasContent(next)) await api.deleteNote(id);
      else if (next) await saveNow(next);
    } catch (error) {
      showToast(getErrorMessage(error));
    }
    goBack('/(app)/notes');
  };

  useAndroidBack(() => {
    if (menu) {
      setMenu(false);
      return true;
    }
    if (confirm) {
      setConfirm(false);
      return true;
    }
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
      goBack('/(app)/notes');
    } catch (error) {
      leaving.current = false;
      showToast(getErrorMessage(error));
    }
  };

  if (!draft) return <PageSkeleton />;

  const changeBlock = (next: NoteBlock) => schedule({ ...draft, blocks: draft.blocks.map((block) => (block.id === next.id ? next : block)) });

  return (
    <Screen>
      <View style={[styles.page, { backgroundColor: draft.color }]}>
        <View style={styles.top}>
          <Pressable accessibilityLabel="Назад" onPress={() => void leave()} hitSlop={12} style={styles.back}>
            <Ionicons name="chevron-back" size={26} color={colors.text} />
            <Text style={styles.backText}>Заметки</Text>
          </Pressable>
          <View style={styles.actions}>
            <Pressable accessibilityLabel={draft.pinned ? 'Открепить' : 'Закрепить'} hitSlop={8} onPress={() => schedule({ ...draft, pinned: !draft.pinned })}>
              <Ionicons name={draft.pinned ? 'pin' : 'pin-outline'} size={22} color={colors.ink} />
            </Pressable>
            <Pressable accessibilityLabel="Удалить" hitSlop={8} onPress={() => setConfirm(true)}>
              <Ionicons name="trash-outline" size={22} color={colors.ink} />
            </Pressable>
          </View>
        </View>
        <ScrollView contentContainerStyle={[styles.body, { paddingBottom: insets.bottom + 72 }]} keyboardShouldPersistTaps="handled">
          <TextInput value={draft.title} onChangeText={(title) => schedule({ ...draft, title })} placeholder="Заголовок" placeholderTextColor={colors.inkMuted} style={styles.title} />
          {draft.blocks.map((block) => (
            <NoteBlockView
              key={block.id}
              block={block}
              focusId={focusId}
              onChange={changeBlock}
              onRemove={() => schedule({ ...draft, blocks: draft.blocks.filter((item) => item.id !== block.id) })}
              onFocus={setFocusId}
            />
          ))}
          <Pressable accessibilityLabel="Добавить блок" onPress={() => setMenu(true)} style={styles.add}>
            <Ionicons name="add" size={22} color={theme.primary} />
          </Pressable>
          <View style={styles.colors}>
            {NOTE_COLORS.map((color) => (
              <Pressable key={color} accessibilityLabel="Цвет" onPress={() => schedule({ ...draft, color })} style={[styles.color, { backgroundColor: color }, draft.color === color && styles.colorOn]} />
            ))}
          </View>
        </ScrollView>
      </View>
      <Modal visible={menu} transparent animationType="fade" onRequestClose={() => setMenu(false)}>
        <Pressable style={styles.backdrop} onPress={() => setMenu(false)}>
          <Pressable style={[styles.sheet, { paddingBottom: insets.bottom + spacing.xl }]} onPress={() => undefined}>
            <Text style={styles.sheetTitle}>Добавить</Text>
            {ADDITIONS.map((item) => (
              <Pressable
                key={item.type}
                style={styles.option}
                onPress={() => {
                  schedule({ ...draft, blocks: [...draft.blocks, emptyBlock(item.type)] });
                  setMenu(false);
                }}
              >
                <Ionicons name={item.icon} size={20} color={theme.primary} />
                <Text style={styles.optionText}>{item.label}</Text>
              </Pressable>
            ))}
          </Pressable>
        </Pressable>
      </Modal>
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

function NoteBlockView({
  block,
  focusId,
  onChange,
  onRemove,
  onFocus,
}: {
  block: NoteBlock;
  focusId: string | null;
  onChange: (block: NoteBlock) => void;
  onRemove: () => void;
  onFocus: (id: string) => void;
}) {
  const theme = useTheme();
  const dropping = useRef(false);
  const itemRefs = useRef<Record<string, TextInput | null>>({});
  if (block.type === 'divider') {
    return (
      <View style={styles.blockRow}>
        <View style={styles.divider} />
        <Close onPress={onRemove} />
      </View>
    );
  }
  if (block.type === 'heading' || block.type === 'text') {
    return (
      <View style={styles.blockRow}>
        <TextInput
          value={block.text}
          onChangeText={(text) => onChange({ ...block, text })}
          placeholder={block.type === 'heading' ? 'Заголовок' : 'Текст'}
          placeholderTextColor={colors.inkMuted}
          multiline={block.type === 'text'}
          style={[styles.input, block.type === 'heading' && styles.headingInput, styles.flex]}
        />
        <Close onPress={onRemove} />
      </View>
    );
  }
  if (block.type === 'table') {
    const setCell = (rowIndex: number, columnIndex: number, value: string) => {
      onChange({ ...block, rows: block.rows.map((row, place) => (place === rowIndex ? row.map((cell, index) => (index === columnIndex ? value : cell)) : row)) });
    };
    return (
      <View style={styles.tableWrap}>
        <View style={styles.blockRow}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.flex}>
            <View>
              <View style={styles.tableRow}>
                {block.columns.map((column, index) => (
                  <TextInput
                    key={`h-${index}`}
                    value={column}
                    onChangeText={(value) => onChange({ ...block, columns: block.columns.map((item, place) => (place === index ? value : item)) })}
                    placeholder="Столбец"
                    placeholderTextColor={colors.inkMuted}
                    style={[styles.cell, styles.headCell]}
                  />
                ))}
              </View>
              {block.rows.map((row, rowIndex) => (
                <View key={`r-${rowIndex}`} style={styles.tableRow}>
                  {block.columns.map((_, columnIndex) => (
                    <TextInput key={`c-${rowIndex}-${columnIndex}`} value={row[columnIndex] ?? ''} onChangeText={(value) => setCell(rowIndex, columnIndex, value)} style={styles.cell} />
                  ))}
                </View>
              ))}
            </View>
          </ScrollView>
          <Close onPress={onRemove} />
        </View>
        <View style={styles.tableActions}>
          <Pressable onPress={() => onChange({ ...block, rows: [...block.rows, block.columns.map(() => '')] })}>
            <Text style={[styles.action, { color: theme.primary }]}>+ строка</Text>
          </Pressable>
          <Pressable onPress={() => onChange({ ...block, columns: [...block.columns, ''], rows: block.rows.map((row) => [...row, '']) })}>
            <Text style={[styles.action, { color: theme.primary }]}>+ столбец</Text>
          </Pressable>
        </View>
      </View>
    );
  }
  const marker = (index: number) => (block.type === 'number' ? `${index + 1}.` : '•');
  const dropItem = (itemId: string) => {
    const index = block.items.findIndex((entry) => entry.id === itemId);
    const next = block.items.filter((entry) => entry.id !== itemId);
    const focus = next[index - 1] ?? next[index];
    onChange({ ...block, items: next });
    if (focus) {
      onFocus(focus.id);
      requestAnimationFrame(() => itemRefs.current[focus.id]?.focus());
    }
  };
  const eraseItem = (item: (typeof block.items)[number]) => {
    if (item.done || item.text.length === 0) {
      dropItem(item.id);
      return;
    }
    onChange({ ...block, items: block.items.map((entry) => (entry.id === item.id ? { ...entry, text: entry.text.slice(0, -1) } : entry)) });
  };
  return (
    <View style={styles.blockRow}>
      <View style={styles.flex}>
        {block.items.map((item, index) => (
          <View key={item.id} style={styles.itemRow}>
            {block.type === 'todo' ? (
              <Pressable onPress={() => onChange({ ...block, items: block.items.map((entry) => (entry.id === item.id ? { ...entry, done: !entry.done } : entry)) })} hitSlop={6}>
                <Ionicons name={item.done ? 'checkbox' : 'square-outline'} size={20} color={theme.primary} />
              </Pressable>
            ) : (
              <Text style={styles.marker}>{marker(index)}</Text>
            )}
            <TextInput
              ref={(node) => {
                itemRefs.current[item.id] = node;
              }}
              value={item.text}
              autoFocus={focusId === item.id}
              onKeyPress={(event) => {
                if (block.type !== 'todo' || event.nativeEvent.key !== 'Backspace') return;
                if (!item.done && item.text.length > 0) return;
                dropping.current = true;
                (event as { preventDefault?: () => void }).preventDefault?.();
                dropItem(item.id);
              }}
              onChangeText={(text) => {
                if (dropping.current) {
                  dropping.current = false;
                  return;
                }
                if (block.type === 'todo' && item.done && text.length < item.text.length) {
                  dropItem(item.id);
                  return;
                }
                onChange({ ...block, items: block.items.map((entry) => (entry.id === item.id ? { ...entry, text } : entry)) });
              }}
              onSubmitEditing={() => {
                if (block.type !== 'todo') return;
                const id = blockId();
                onFocus(id);
                onChange({ ...block, items: [...block.items, { id, text: '', done: false }] });
              }}
              placeholder="Пункт"
              placeholderTextColor={colors.inkMuted}
              returnKeyType={block.type === 'todo' ? 'next' : 'default'}
              blurOnSubmit={block.type !== 'todo'}
              style={[styles.itemInput, item.done && styles.done]}
            />
            {block.type === 'todo' ? (
              <Pressable accessibilityLabel="Стереть" hitSlop={6} onPress={() => eraseItem(item)}>
                <Ionicons name="backspace-outline" size={18} color={colors.textSecondary} />
              </Pressable>
            ) : null}
          </View>
        ))}
        <Pressable
          onPress={() => {
            const id = blockId();
            onFocus(id);
            onChange({ ...block, items: [...block.items, { id, text: '', done: false }] });
          }}
        >
          <Text style={[styles.action, { color: theme.primary }]}>+ пункт</Text>
        </Pressable>
      </View>
      <Close onPress={onRemove} />
    </View>
  );
}

function Close({ onPress }: { onPress: () => void }) {
  return (
    <Pressable accessibilityLabel="Удалить блок" hitSlop={8} onPress={onPress}>
      <Ionicons name="close" size={18} color={colors.textSecondary} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1 },
  top: { paddingHorizontal: spacing.md, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  back: { flexDirection: 'row', alignItems: 'center', minHeight: 40 },
  backText: { fontSize: 16, fontWeight: '600', color: colors.text },
  actions: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  body: { paddingHorizontal: spacing.lg, gap: spacing.sm },
  title: { fontSize: 28, fontWeight: '800', color: colors.ink, paddingVertical: spacing.sm },
  colors: { flexDirection: 'row', gap: spacing.sm, paddingVertical: spacing.md },
  color: { width: 28, height: 28, borderRadius: 14, borderWidth: 1, borderColor: colors.border },
  colorOn: { borderWidth: 3, borderColor: colors.text },
  add: { minHeight: 44, justifyContent: 'center' },
  blockRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  flex: { flex: 1 },
  input: { minHeight: 48, borderWidth: 1, borderColor: colors.border, borderRadius: radii.md, paddingHorizontal: spacing.md, color: colors.ink, backgroundColor: colors.surface },
  headingInput: { fontSize: 22, fontWeight: '800', minHeight: 52 },
  divider: { flex: 1, height: 1, backgroundColor: colors.border, marginVertical: 16 },
  itemRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, minHeight: 40 },
  marker: { width: 22, fontSize: 16, fontWeight: '700', color: colors.textSecondary },
  itemInput: { flex: 1, minHeight: 40, fontSize: 16, color: colors.ink },
  done: { color: colors.inkMuted, textDecorationLine: 'line-through' },
  action: { fontSize: 14, fontWeight: '700', paddingVertical: 6 },
  tableWrap: { gap: spacing.xs },
  tableRow: { flexDirection: 'row' },
  cell: { width: 120, minHeight: 40, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 8, color: colors.ink, backgroundColor: colors.surface },
  headCell: { fontWeight: '800', backgroundColor: '#F8E7B8' },
  tableActions: { flexDirection: 'row', gap: spacing.md },
  backdrop: { flex: 1, backgroundColor: 'rgba(26, 8, 48, 0.45)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: colors.surface, borderTopLeftRadius: radii.xl, borderTopRightRadius: radii.xl, padding: spacing.lg, gap: spacing.sm },
  sheetTitle: { fontSize: 14, fontWeight: '800', color: colors.textSecondary },
  option: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, minHeight: 46 },
  optionText: { flex: 1, fontSize: 16, fontWeight: '700', color: colors.text },
});
