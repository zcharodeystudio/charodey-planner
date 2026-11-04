import { createElement, useCallback, useEffect, useRef, useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { WebView } from 'react-native-webview';
import type { NoteSpan, NoteTextStyle } from '@/api/client';
import { richEditorScript } from '@/lib/rich-editor-script';
import { useTheme } from '@/store/theme-context';
import { colors, spacing } from '@/theme/theme';

type StyleCommand = { toggle?: 'bold' | 'italic' | 'underline'; size?: NoteTextStyle['size']; font?: NoteTextStyle['font'] };

type EditorApi = {
  init: (spans: NoteSpan[]) => void;
  command: (style: StyleCommand) => void;
};

type EditorMessage =
  | { type: 'change'; spans: NoteSpan[]; text: string }
  | { type: 'caret'; style: NoteTextStyle }
  | { type: 'height'; height: number };

const editorCss = `
  .rich-editor, #editor {
    width: 100%;
    box-sizing: border-box;
    min-height: 88px;
    outline: none;
    white-space: pre-wrap;
    overflow-wrap: anywhere;
    color: #3A2614;
    font-size: 16px;
    line-height: 22px;
    padding: 8px 0;
    font-family: sans-serif;
    background: transparent;
  }
  .rich-editor[data-empty="1"]:before, #editor[data-empty="1"]:before {
    content: "Текст";
    color: #8A6844;
  }
`;

function editorHtml() {
  return `<!DOCTYPE html><html><head><meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />
<style>html,body{margin:0;background:transparent;}${editorCss}</style></head><body>
<div id="editor"></div>
<script>
${richEditorScript}
var api = mountRichEditor(document.getElementById('editor'), function (message) {
  window.ReactNativeWebView.postMessage(JSON.stringify(message));
});
window.richInit = function (raw) { api.init(JSON.parse(raw)); };
window.richCommand = function (raw) { api.command(JSON.parse(raw)); };
</script></body></html>`;
}

const NOTE_SIZES: { id: '12' | '14' | '16' | '18' | '22' | '28' | '36'; label: string }[] = [
  { id: '12', label: '12' },
  { id: '14', label: '14' },
  { id: '16', label: '16' },
  { id: '18', label: '18' },
  { id: '22', label: '22' },
  { id: '28', label: '28' },
  { id: '36', label: '36' },
];
const MENU_HEIGHT = 34 * 5;

function canonicalSize(size?: string) {
  if (size === 's') return '14';
  if (size === 'm') return '16';
  if (size === 'l') return '22';
  return NOTE_SIZES.some((item) => item.id === size) ? size : '';
}

const NOTE_FONTS: { id: NonNullable<NoteTextStyle['font']>; label: string; family: string }[] = [
  { id: 'sans', label: 'Основной', family: 'system-ui, "Segoe UI", sans-serif' },
  { id: 'serif', label: 'Georgia', family: 'Georgia, Palatino, serif' },
  { id: 'times', label: 'Times', family: '"Times New Roman", Times, serif' },
  { id: 'script', label: 'Рукопись', family: '"Segoe Script", "Segoe Print", cursive' },
  { id: 'mono', label: 'Моно', family: '"Courier New", ui-monospace, Menlo, monospace' },
];

function StyleBar({ style, onChange }: { style: NoteTextStyle; onChange: (style: StyleCommand) => void }) {
  const theme = useTheme();
  const barRef = useRef<HTMLDivElement | null>(null);
  const [menu, setMenu] = useState<'size' | 'font' | null>(null);
  const color = (active: boolean) => (active ? theme.primaryPressed : colors.textSecondary);
  const currentFont = NOTE_FONTS.find((font) => font.id === style.font);
  const currentSize = canonicalSize(style.size);
  const buttons: { label: string; text: string; active: boolean; command: StyleCommand; fontStyle?: 'italic'; underline?: boolean }[] = [
    { label: 'Жирный', text: 'Ж', active: Boolean(style.bold), command: { toggle: 'bold' } },
    { label: 'Курсив', text: 'К', active: Boolean(style.italic), command: { toggle: 'italic' }, fontStyle: 'italic' },
    { label: 'Подчёркнутый', text: 'Ч', active: Boolean(style.underline), command: { toggle: 'underline' }, underline: true },
  ];
  const toggleMenu = (name: 'size' | 'font') => setMenu((value) => (value === name ? null : name));

  useEffect(() => {
    if (!menu || Platform.OS !== 'web') return;
    const close = (event: MouseEvent) => {
      if (barRef.current?.contains(event.target as Node)) return;
      setMenu(null);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [menu]);

  const pickSize = (size: (typeof NOTE_SIZES)[number]['id']) => {
    onChange({ size });
    setMenu(null);
  };
  const pickFont = (font: NonNullable<NoteTextStyle['font']>) => {
    onChange({ font });
    setMenu(null);
  };

  if (Platform.OS === 'web') {
    return createElement(
      'div',
      {
        ref: (node: HTMLDivElement | null) => {
          barRef.current = node;
          if (!node || node.dataset.bound) return;
          node.dataset.bound = '1';
          node.addEventListener('mousedown', (event) => event.preventDefault(), true);
        },
        onMouseDown: (event: { preventDefault: () => void }) => event.preventDefault(),
        style: { display: 'flex', flexDirection: 'column', gap: 4 },
      },
      createElement(
        'div',
        { style: { display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8 } },
        ...buttons.map((button) =>
          createElement(
            'button',
            {
              key: button.label,
              type: 'button',
              'aria-label': button.label,
              onMouseDown: (event: { preventDefault: () => void }) => {
                event.preventDefault();
                onChange(button.command);
              },
              style: {
                border: 0,
                background: 'transparent',
                padding: 4,
                minWidth: 28,
                cursor: 'pointer',
                fontWeight: 800,
                fontSize: 16,
                color: color(button.active),
                fontStyle: button.fontStyle,
                textDecoration: button.underline ? 'underline' : 'none',
              },
            },
            button.text,
          ),
        ),
        createElement(
          'button',
          {
            key: 'size',
            type: 'button',
            'aria-label': 'Размер',
            'aria-expanded': menu === 'size',
            onMouseDown: (event: { preventDefault: () => void }) => {
              event.preventDefault();
              toggleMenu('size');
            },
            style: {
              border: 0,
              background: 'transparent',
              padding: 4,
              cursor: 'pointer',
              fontWeight: 800,
              fontSize: 16,
              color: color(menu === 'size' || (Boolean(currentSize) && currentSize !== '16')),
            },
          },
          `${currentSize || 'Размер'} ${menu === 'size' ? '▴' : '▾'}`,
        ),
        createElement(
          'button',
          {
            key: 'font',
            type: 'button',
            'aria-label': 'Шрифт',
            'aria-expanded': menu === 'font',
            onMouseDown: (event: { preventDefault: () => void }) => {
              event.preventDefault();
              toggleMenu('font');
            },
            style: {
              border: 0,
              background: 'transparent',
              padding: 4,
              cursor: 'pointer',
              fontWeight: 800,
              fontSize: 16,
              color: color(menu === 'font' || (Boolean(style.font) && style.font !== 'sans')),
            },
          },
          `${currentFont?.label ?? 'Шрифт'} ${menu === 'font' ? '▴' : '▾'}`,
        ),
      ),
      createElement(
        'div',
        {
          style: {
            display: 'flex',
            flexDirection: 'column',
            overflowX: 'hidden',
            overflowY: menu ? 'auto' : 'hidden',
            maxHeight: menu ? MENU_HEIGHT : 0,
            opacity: menu ? 1 : 0,
            transform: menu ? 'translateY(0)' : 'translateY(-8px)',
            transition: 'max-height 180ms ease, opacity 160ms ease, transform 180ms ease',
            pointerEvents: menu ? 'auto' : 'none',
          },
        },
        ...(menu === 'size' ? NOTE_SIZES : []).map((size) =>
          createElement(
            'button',
            {
              key: size.id,
              type: 'button',
              'aria-label': `Размер ${size.label}`,
              onMouseDown: (event: { preventDefault: () => void }) => {
                event.preventDefault();
                pickSize(size.id);
              },
              style: {
                border: 0,
                background: 'transparent',
                flexShrink: 0,
                textAlign: 'left',
                height: 34,
                padding: '0 4px',
                cursor: 'pointer',
                fontSize: 16,
                fontWeight: currentSize === size.id ? 800 : 500,
                color: color(currentSize === size.id),
              },
            },
            size.label,
          ),
        ),
        ...(menu === 'font' ? NOTE_FONTS : []).map((font) =>
          createElement(
            'button',
            {
              key: font.id,
              type: 'button',
              'aria-label': font.label,
              onMouseDown: (event: { preventDefault: () => void }) => {
                event.preventDefault();
                pickFont(font.id);
              },
              style: {
                border: 0,
                background: 'transparent',
                flexShrink: 0,
                textAlign: 'left',
                height: 34,
                padding: '0 4px',
                cursor: 'pointer',
                fontSize: 16,
                fontFamily: font.family,
                fontWeight: style.font === font.id ? 800 : 500,
                color: color(style.font === font.id),
              },
            },
            font.label,
          ),
        ),
      ),
    );
  }

  return (
    <View>
      <View style={styles.bar}>
        {buttons.map((button) => (
          <Pressable key={button.label} accessibilityLabel={button.label} onPressIn={() => onChange(button.command)} hitSlop={6}>
            <Text style={[styles.mark, { color: color(button.active), fontStyle: button.fontStyle, textDecorationLine: button.underline ? 'underline' : 'none' }]}>{button.text}</Text>
          </Pressable>
        ))}
        <Pressable accessibilityLabel="Размер" onPressIn={() => toggleMenu('size')} hitSlop={6}>
          <Text style={[styles.mark, { color: color(menu === 'size' || (Boolean(currentSize) && currentSize !== '16')) }]}>{`${currentSize || 'Размер'} ${menu === 'size' ? '▴' : '▾'}`}</Text>
        </Pressable>
        <Pressable accessibilityLabel="Шрифт" onPressIn={() => toggleMenu('font')} hitSlop={6}>
          <Text style={[styles.mark, { color: color(menu === 'font' || (Boolean(style.font) && style.font !== 'sans')) }]}>{`${currentFont?.label ?? 'Шрифт'} ${menu === 'font' ? '▴' : '▾'}`}</Text>
        </Pressable>
      </View>
      {menu ? (
        <ScrollView style={styles.menuScroll} nestedScrollEnabled keyboardShouldPersistTaps="handled">
          {menu === 'size'
            ? NOTE_SIZES.map((size) => (
                <Pressable key={size.id} accessibilityLabel={`Размер ${size.label}`} onPressIn={() => pickSize(size.id)} hitSlop={4}>
                  <Text style={[styles.fontItem, { color: color(currentSize === size.id), fontWeight: currentSize === size.id ? '800' : '500' }]}>{size.label}</Text>
                </Pressable>
              ))
            : NOTE_FONTS.map((font) => (
                <Pressable key={font.id} accessibilityLabel={font.label} onPressIn={() => pickFont(font.id)} hitSlop={4}>
                  <Text style={[styles.fontItem, { fontFamily: font.family, color: color(style.font === font.id), fontWeight: style.font === font.id ? '800' : '500' }]}>{font.label}</Text>
                </Pressable>
              ))}
        </ScrollView>
      ) : null}
    </View>
  );
}

export function RichNote({ spans, onChange }: { spans: NoteSpan[]; onChange: (spans: NoteSpan[]) => void }) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const apiRef = useRef<EditorApi | null>(null);
  const webRef = useRef<WebView>(null);
  const htmlRef = useRef(editorHtml());
  const serialRef = useRef('');
  const spansRef = useRef(spans);
  const onChangeRef = useRef(onChange);
  const readyRef = useRef(false);
  const [caret, setCaret] = useState<NoteTextStyle>({ size: 'm', font: 'sans' });
  const [height, setHeight] = useState(88);
  spansRef.current = spans;
  onChangeRef.current = onChange;

  const accept = (message: EditorMessage) => {
    if (message.type === 'height') {
      setHeight(Math.max(88, Math.ceil(message.height)));
      return;
    }
    if (message.type === 'caret') {
      setCaret(message.style);
      return;
    }
    serialRef.current = JSON.stringify(message.spans);
    onChangeRef.current(message.spans);
  };

  const sendStyle = (style: StyleCommand) => {
    if (Platform.OS === 'web') {
      apiRef.current?.command(style);
      return;
    }
    webRef.current?.injectJavaScript(`window.richCommand && window.richCommand(${JSON.stringify(JSON.stringify(style))}); true;`);
  };

  const sendSpans = (next: NoteSpan[]) => {
    const raw = JSON.stringify(next);
    if (raw === serialRef.current) return;
    if (Platform.OS === 'web') {
      if (!apiRef.current) return;
      serialRef.current = raw;
      apiRef.current.init(next);
      return;
    }
    if (!readyRef.current) return;
    serialRef.current = raw;
    webRef.current?.injectJavaScript(`window.richInit && window.richInit(${JSON.stringify(raw)}); true;`);
  };

  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const documentRef = globalThis.document;
    if (!documentRef || documentRef.getElementById('rich-editor-style')) return;
    const style = documentRef.createElement('style');
    style.id = 'rich-editor-style';
    style.textContent = editorCss;
    documentRef.head.appendChild(style);
  }, []);

  const sendSpansRef = useRef(sendSpans);
  sendSpansRef.current = sendSpans;

  const attachWeb = useCallback((node: HTMLDivElement | null) => {
    if (!node) return;
    if (hostRef.current === node && apiRef.current) return;
    hostRef.current = node;
    const factory = new Function('root', 'post', `${richEditorScript}\nreturn mountRichEditor(root, post);`) as (
      root: HTMLElement,
      post: (message: EditorMessage) => void,
    ) => EditorApi;
    apiRef.current = factory(node, (message) => accept(message));
    serialRef.current = '';
    sendSpansRef.current(spansRef.current);
  }, []);

  useEffect(() => {
    sendSpans(spans);
  }, [spans]);

  return (
    <View style={styles.wrap}>
      <StyleBar style={caret} onChange={sendStyle} />
      {Platform.OS === 'web' ? (
        createElement('div', {
          ref: attachWeb,
          className: 'rich-editor',
          style: { width: '100%' },
        })
      ) : (
        <WebView
          ref={webRef}
          originWhitelist={['*']}
          source={{ html: htmlRef.current }}
          scrollEnabled={false}
          onLoadEnd={() => {
            readyRef.current = true;
            serialRef.current = '';
            sendSpans(spansRef.current);
          }}
          onMessage={(event) => {
            try {
              accept(JSON.parse(event.nativeEvent.data) as EditorMessage);
            } catch {
              // Ignore a malformed editor message.
            }
          }}
          style={[styles.web, { height }]}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, gap: spacing.xs },
  bar: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: spacing.sm },
  mark: { fontSize: 16, minWidth: 28, textAlign: 'center' },
  menuScroll: { maxHeight: MENU_HEIGHT },
  fontItem: { fontSize: 16, height: 34, lineHeight: 34, paddingHorizontal: 4 },
  editor: { minHeight: 88 },
  web: { minHeight: 88, backgroundColor: 'transparent' },
});
