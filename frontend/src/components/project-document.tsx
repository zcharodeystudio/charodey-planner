import { Ionicons } from '@expo/vector-icons';
import { Href, router, useFocusEffect } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { api, type BoardItem, type ProjectBlock, type ProjectBlockType, type ProjectItem, type ProjectPageLink } from '@/api/client';
import { ConfirmModal } from '@/components/confirm-modal';
import { Button } from '@/components/ui/button';
import { Screen, ScreenLoader } from '@/components/ui/screen';
import { useAndroidBack } from '@/lib/android-back';
import { getErrorMessage } from '@/lib/errors';
import { showToast } from '@/lib/toast';
import { useTheme } from '@/store/theme-context';
import { colors, radii, spacing } from '@/theme/theme';

const ADDITIONS: { type: ProjectBlockType; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { type: 'page', label: 'Страница', icon: 'document-outline' },
  { type: 'board', label: 'Доска', icon: 'albums-outline' },
  { type: 'table', label: 'Таблица', icon: 'grid-outline' },
  { type: 'text', label: 'Текст', icon: 'document-text-outline' },
  { type: 'heading', label: 'Заголовок', icon: 'text-outline' },
  { type: 'number', label: 'Нумерованный список', icon: 'list-outline' },
  { type: 'bullet', label: 'Маркированный список', icon: 'list' },
  { type: 'todo', label: 'Туду-лист', icon: 'checkbox-outline' },
  { type: 'divider', label: 'Разделитель', icon: 'remove-outline' },
];

const itemId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

export function ProjectDocument({ projectId, pageId }: { projectId: string; pageId?: string }) {
  const theme = useTheme();
  const [project, setProject] = useState<ProjectItem | null>(null);
  const [boards, setBoards] = useState<BoardItem[]>([]);
  const [blocks, setBlocks] = useState<ProjectBlock[]>([]);
  const [pages, setPages] = useState<ProjectPageLink[]>([]);
  const [pageTitle, setPageTitle] = useState('');
  const [loading, setLoading] = useState(true);
  const [menu, setMenu] = useState(false);
  const [boardName, setBoardName] = useState('');
  const [namingBoard, setNamingBoard] = useState(false);
  const [pageSheet, setPageSheet] = useState(false);
  const [pageName, setPageName] = useState('');
  const [confirmPage, setConfirmPage] = useState(false);
  const timers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const titleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(() => {
    const apply = (data: { project: ProjectItem; boards: BoardItem[]; blocks: ProjectBlock[]; pages: ProjectPageLink[] }) => {
      setProject(data.project);
      setBoards(data.boards);
      setBlocks(data.blocks ?? []);
      setPages(data.pages ?? []);
    };
    const request = pageId
      ? api.projectPage(projectId, pageId).then((data) => {
          apply(data);
          setPageTitle(data.page.title);
        })
      : api.project(projectId).then(apply);
    void request.catch((error) => showToast(getErrorMessage(error))).finally(() => setLoading(false));
  }, [pageId, projectId]);

  useFocusEffect(load);

  const onHardwareBack = useCallback(() => {
    if (menu) {
      setMenu(false);
      return true;
    }
    if (pageSheet) {
      setPageSheet(false);
      setPageName('');
      return true;
    }
    if (namingBoard) {
      setNamingBoard(false);
      setBoardName('');
      return true;
    }
    if (confirmPage) {
      setConfirmPage(false);
      return true;
    }
    return false;
  }, [confirmPage, menu, namingBoard, pageSheet]);
  useAndroidBack(onHardwareBack);

  const saveLater = (block: ProjectBlock) => {
    clearTimeout(timers.current[block.id]);
    timers.current[block.id] = setTimeout(() => {
      void api
        .updateBlock(projectId, block.id, { text: block.text, items: block.items, columns: block.columns, rows: block.rows }, pageId)
        .catch((error) => showToast(getErrorMessage(error)));
    }, 400);
  };

  const changeBlock = (next: ProjectBlock) => {
    setBlocks((current) => current.map((block) => (block.id === next.id ? next : block)));
    saveLater(next);
  };

  const changeTitle = (title: string) => {
    setPageTitle(title);
    if (!pageId) return;
    if (titleTimer.current) clearTimeout(titleTimer.current);
    titleTimer.current = setTimeout(() => {
      void api.updatePage(projectId, pageId, title).catch((error) => showToast(getErrorMessage(error)));
    }, 400);
  };

  const add = async (type: ProjectBlockType, options?: { name?: string; targetPageId?: string }) => {
    try {
      const created = await api.addBlock(projectId, type, { ...options, parentPageId: pageId });
      setBlocks((current) => [...current, created.block]);
      if (created.board) setBoards((current) => [...current, created.board as BoardItem]);
      if (created.page) setPages((current) => [...current, created.page as ProjectPageLink]);
      setMenu(false);
      setNamingBoard(false);
      setBoardName('');
      setPageSheet(false);
      setPageName('');
      if (created.page) router.push(`/(app)/doc/${projectId}/${created.page.id}` as Href);
      return created;
    } catch (error) {
      showToast(getErrorMessage(error));
      return null;
    }
  };

  const remove = async (block: ProjectBlock) => {
    setBlocks((current) => current.filter((item) => item.id !== block.id));
    if (block.boardId) setBoards((current) => current.filter((board) => board.id !== block.boardId));
    try {
      await api.deleteBlock(projectId, block.id, pageId);
    } catch (error) {
      showToast(getErrorMessage(error));
      load();
    }
  };

  const removePage = async () => {
    if (!pageId) return;
    try {
      await api.deletePage(projectId, pageId);
      showToast('Страница удалена');
      router.back();
    } catch (error) {
      showToast(getErrorMessage(error));
    }
  };

  const openPage = (targetId: string | null) => {
    if (!targetId) return;
    router.push(`/(app)/doc/${projectId}/${targetId}` as Href);
  };

  if (loading && !project) return <ScreenLoader />;

  const otherPages = pages.filter((page) => page.id !== pageId);

  return (
    <Screen>
      <View style={styles.top}>
        <Pressable accessibilityLabel="Назад" onPress={() => router.back()} hitSlop={12} style={styles.back}>
          <Ionicons name="chevron-back" size={26} color={colors.text} />
          <Text style={styles.backText}>{pageId ? (project?.name ?? 'Проект') : 'Профиль'}</Text>
        </Pressable>
        {pageId ? (
          <Pressable accessibilityLabel="Удалить страницу" hitSlop={8} onPress={() => setConfirmPage(true)}>
            <Ionicons name="trash-outline" size={22} color={colors.textSecondary} />
          </Pressable>
        ) : null}
      </View>
      <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        {pageId ? (
          <TextInput
            value={pageTitle}
            onChangeText={changeTitle}
            placeholder="Название страницы"
            placeholderTextColor={colors.inkMuted}
            style={styles.headingInput}
          />
        ) : (
          <Text style={styles.heading}>{project?.name ?? 'Проект'}</Text>
        )}
        {blocks.length === 0 && !namingBoard ? <Text style={styles.hint}>Нажмите +, чтобы добавить блок.</Text> : null}
        {blocks.map((block) => (
          <BlockEditor
            key={block.id}
            block={block}
            boardName={boards.find((board) => board.id === block.boardId)?.name}
            onChange={changeBlock}
            onRemove={() => void remove(block)}
            onOpenBoard={() => {
              if (block.boardId) router.push(`/(app)/board/${block.boardId}` as Href);
            }}
            onOpenPage={() => openPage(block.pageId)}
          />
        ))}
        {namingBoard ? (
          <View style={styles.create}>
            <TextInput
              autoFocus
              value={boardName}
              onChangeText={setBoardName}
              onSubmitEditing={() => {
                if (boardName.trim()) void add('board', { name: boardName.trim() });
              }}
              placeholder="Название доски"
              placeholderTextColor={colors.inkMuted}
              style={styles.input}
            />
            <Button title="Создать доску" onPress={() => { if (boardName.trim()) void add('board', { name: boardName.trim() }); }} />
          </View>
        ) : (
          <Pressable accessibilityLabel="Добавить блок" style={styles.add} onPress={() => setMenu(true)}>
            <Ionicons name="add" size={22} color={theme.primary} />
          </Pressable>
        )}
      </ScrollView>
      <Modal visible={menu} transparent animationType="fade" onRequestClose={() => setMenu(false)}>
        <Pressable style={styles.backdrop} onPress={() => setMenu(false)}>
          <Pressable style={styles.sheet} onPress={() => undefined}>
            <Text style={styles.sheetTitle}>Добавить</Text>
            {ADDITIONS.map((item) => (
              <Pressable
                key={item.type}
                style={styles.option}
                onPress={() => {
                  if (item.type === 'board') {
                    setMenu(false);
                    setNamingBoard(true);
                    return;
                  }
                  if (item.type === 'page') {
                    setMenu(false);
                    setPageSheet(true);
                    return;
                  }
                  void add(item.type);
                }}
              >
                <Ionicons name={item.icon} size={20} color={theme.primary} />
                <Text style={styles.optionText}>{item.label}</Text>
              </Pressable>
            ))}
          </Pressable>
        </Pressable>
      </Modal>
      <Modal visible={pageSheet} transparent animationType="fade" onRequestClose={() => setPageSheet(false)}>
        <Pressable style={styles.backdrop} onPress={() => setPageSheet(false)}>
          <Pressable style={styles.sheet} onPress={() => undefined}>
            <Text style={styles.sheetTitle}>Страница</Text>
            <TextInput
              autoFocus
              value={pageName}
              onChangeText={setPageName}
              onSubmitEditing={() => {
                if (pageName.trim()) void add('page', { name: pageName.trim() });
              }}
              placeholder="Название новой страницы"
              placeholderTextColor={colors.inkMuted}
              style={styles.input}
            />
            <Button title="Создать страницу" onPress={() => { if (pageName.trim()) void add('page', { name: pageName.trim() }); }} />
            {otherPages.length > 0 ? <Text style={styles.sheetTitle}>Ссылка на страницу</Text> : null}
            {otherPages.map((page) => (
              <Pressable key={page.id} style={styles.option} onPress={() => void add('page', { name: page.title, targetPageId: page.id })}>
                <Ionicons name="link-outline" size={20} color={theme.primary} />
                <Text style={styles.optionText}>{page.title || 'Без названия'}</Text>
              </Pressable>
            ))}
          </Pressable>
        </Pressable>
      </Modal>
      <ConfirmModal
        visible={confirmPage}
        title="Удалить страницу?"
        message="Страница и ссылки на неё исчезнут."
        onClose={() => setConfirmPage(false)}
        onConfirm={() => {
          setConfirmPage(false);
          void removePage();
        }}
      />
    </Screen>
  );
}

function BlockEditor({
  block,
  boardName,
  onChange,
  onRemove,
  onOpenBoard,
  onOpenPage,
}: {
  block: ProjectBlock;
  boardName?: string;
  onChange: (block: ProjectBlock) => void;
  onRemove: () => void;
  onOpenBoard: () => void;
  onOpenPage: () => void;
}) {
  const theme = useTheme();
  if (block.type === 'divider') {
    return (
      <View style={styles.blockRow}>
        <View style={styles.divider} />
        <Remove onPress={onRemove} />
      </View>
    );
  }
  if (block.type === 'page') {
    return (
      <View style={styles.blockRow}>
        <Pressable accessibilityLabel="Открыть страницу" onPress={onOpenPage} hitSlop={6}>
          <Ionicons name="document-outline" size={22} color={theme.primary} />
        </Pressable>
        <TextInput
          value={block.text}
          onChangeText={(text) => onChange({ ...block, text })}
          placeholder="Текст ссылки"
          placeholderTextColor={colors.inkMuted}
          style={[styles.linkInput, styles.flex, { color: theme.primary }]}
        />
        <Pressable accessibilityLabel="Открыть страницу" hitSlop={8} onPress={onOpenPage}>
          <Ionicons name="arrow-forward" size={18} color={theme.primary} />
        </Pressable>
        <Remove onPress={onRemove} />
      </View>
    );
  }
  if (block.type === 'board') {
    return (
      <View style={styles.blockRow}>
        <Pressable style={styles.board} onPress={onOpenBoard}>
          <Ionicons name="albums-outline" size={20} color={theme.primary} />
          <Text style={styles.boardTitle}>{boardName ?? 'Доска'}</Text>
          <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
        </Pressable>
        <Remove onPress={onRemove} />
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
          style={[styles.input, block.type === 'heading' && styles.blockHeading, styles.flex]}
        />
        <Remove onPress={onRemove} />
      </View>
    );
  }
  if (block.type === 'table') {
    const setColumn = (index: number, value: string) => {
      const columns = block.columns.map((column, place) => (place === index ? value : column));
      onChange({ ...block, columns });
    };
    const setCell = (rowIndex: number, columnIndex: number, value: string) => {
      const rows = block.rows.map((row, place) => (place === rowIndex ? row.map((cell, cellIndex) => (cellIndex === columnIndex ? value : cell)) : row));
      onChange({ ...block, rows });
    };
    return (
      <View style={styles.tableWrap}>
        <View style={styles.blockRow}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.flex}>
            <View>
              <View style={styles.tableRow}>
                {block.columns.map((column, index) => (
                  <TextInput key={`h-${index}`} value={column} onChangeText={(value) => setColumn(index, value)} placeholder="Столбец" placeholderTextColor={colors.inkMuted} style={[styles.cell, styles.headCell]} />
                ))}
              </View>
              {block.rows.map((row, rowIndex) => (
                <View key={`r-${rowIndex}`} style={styles.tableRow}>
                  {block.columns.map((_, columnIndex) => (
                    <TextInput
                      key={`c-${rowIndex}-${columnIndex}`}
                      value={row[columnIndex] ?? ''}
                      onChangeText={(value) => setCell(rowIndex, columnIndex, value)}
                      placeholderTextColor={colors.inkMuted}
                      style={styles.cell}
                    />
                  ))}
                </View>
              ))}
            </View>
          </ScrollView>
          <Remove onPress={onRemove} />
        </View>
        <View style={styles.tableActions}>
          <Pressable onPress={() => onChange({ ...block, rows: [...block.rows, block.columns.map(() => '')] })}>
            <Text style={[styles.action, { color: theme.primary }]}>+ строка</Text>
          </Pressable>
          <Pressable
            onPress={() =>
              onChange({
                ...block,
                columns: [...block.columns, ''],
                rows: block.rows.map((row) => [...row, '']),
              })
            }
          >
            <Text style={[styles.action, { color: theme.primary }]}>+ столбец</Text>
          </Pressable>
        </View>
      </View>
    );
  }
  const marker = (index: number) => (block.type === 'number' ? `${index + 1}.` : block.type === 'bullet' ? '•' : '');
  return (
    <View style={styles.listBlock}>
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
                value={item.text}
                onChangeText={(text) => onChange({ ...block, items: block.items.map((entry) => (entry.id === item.id ? { ...entry, text } : entry)) })}
                placeholder="Пункт"
                placeholderTextColor={colors.inkMuted}
                style={[styles.itemInput, item.done && styles.done]}
              />
            </View>
          ))}
          <Pressable onPress={() => onChange({ ...block, items: [...block.items, { id: itemId(), text: '', done: false }] })}>
            <Text style={[styles.action, { color: theme.primary }]}>+ пункт</Text>
          </Pressable>
        </View>
        <Remove onPress={onRemove} />
      </View>
    </View>
  );
}

function Remove({ onPress }: { onPress: () => void }) {
  return (
    <Pressable accessibilityLabel="Удалить блок" hitSlop={8} onPress={onPress}>
      <Ionicons name="close" size={18} color={colors.textSecondary} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  top: { paddingHorizontal: spacing.md, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  back: { flexDirection: 'row', alignItems: 'center', minHeight: 40, flex: 1 },
  backText: { fontSize: 16, fontWeight: '600', color: colors.text },
  body: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xl, gap: spacing.sm },
  heading: { fontSize: 28, fontWeight: '800', color: colors.text, marginBottom: spacing.sm },
  headingInput: { fontSize: 28, fontWeight: '800', color: colors.text, marginBottom: spacing.sm, padding: 0 },
  hint: { fontSize: 14, lineHeight: 20, color: colors.textSecondary },
  add: { minHeight: 44, justifyContent: 'center' },
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
  blockHeading: { fontSize: 22, fontWeight: '800', minHeight: 52 },
  linkInput: { minHeight: 44, fontSize: 16, fontWeight: '700', textDecorationLine: 'underline', paddingVertical: 8 },
  flex: { flex: 1 },
  blockRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  divider: { flex: 1, height: 1, backgroundColor: colors.border, marginVertical: 16 },
  board: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    minHeight: 52,
    paddingHorizontal: spacing.md,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  boardTitle: { flex: 1, fontSize: 16, fontWeight: '700', color: colors.text },
  listBlock: { gap: 4 },
  itemRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, minHeight: 40 },
  marker: { width: 22, fontSize: 16, fontWeight: '700', color: colors.textSecondary },
  itemInput: { flex: 1, minHeight: 40, fontSize: 16, color: colors.ink },
  done: { color: colors.inkMuted, textDecorationLine: 'line-through' },
  tableWrap: { gap: spacing.xs },
  tableRow: { flexDirection: 'row' },
  cell: {
    width: 120,
    minHeight: 40,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 8,
    color: colors.ink,
    backgroundColor: colors.surface,
  },
  headCell: { fontWeight: '800', backgroundColor: '#F8E7B8' },
  tableActions: { flexDirection: 'row', gap: spacing.md },
  action: { fontSize: 14, fontWeight: '700', paddingVertical: 6 },
  backdrop: { flex: 1, backgroundColor: 'rgba(26, 8, 48, 0.45)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radii.xl,
    borderTopRightRadius: radii.xl,
    padding: spacing.lg,
    gap: spacing.sm,
    maxHeight: '80%',
  },
  sheetTitle: { fontSize: 14, fontWeight: '800', color: colors.textSecondary, marginTop: spacing.xs },
  option: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, minHeight: 46 },
  optionText: { flex: 1, fontSize: 16, fontWeight: '700', color: colors.text },
});
