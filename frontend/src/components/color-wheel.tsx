import { useEffect, useRef, useState } from 'react';
import { Modal, Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { hexToHsv, hsvToHex } from '@/lib/color';
import { colors, radii } from '@/theme/theme';

const SIZE = 200;
const GAP = 8;
const MARGIN = 8;
const STEP = 4;
const RADIUS = SIZE / 2;

const CELLS = (() => {
  const cells: { left: number; top: number; color: string }[] = [];
  for (let top = 0; top < SIZE; top += STEP) {
    for (let left = 0; left < SIZE; left += STEP) {
      const dx = left + STEP / 2 - RADIUS;
      const dy = top + STEP / 2 - RADIUS;
      const dist = Math.hypot(dx, dy);
      if (dist > RADIUS + STEP) continue;
      const hue = (Math.atan2(dy, dx) * 180) / Math.PI;
      cells.push({ left, top, color: hsvToHex((hue + 360) % 360, Math.min(1, dist / RADIUS), 1) });
    }
  }
  return cells;
})();

function colorAt(x: number, y: number) {
  const dx = x - RADIUS;
  const dy = y - RADIUS;
  const dist = Math.hypot(dx, dy);
  if (dist > RADIUS) return null;
  const hue = (Math.atan2(dy, dx) * 180) / Math.PI;
  return hsvToHex((hue + 360) % 360, Math.min(1, dist / RADIUS), 1);
}

type Anchor = { x: number; y: number; width: number; height: number };

function placeWheel(anchor: Anchor, windowWidth: number, windowHeight: number, topInset: number, bottomInset: number) {
  let left = anchor.x + anchor.width + GAP;
  const maxLeft = windowWidth - MARGIN - SIZE;
  if (left > maxLeft) left = Math.max(MARGIN, maxLeft);

  const upwardTop = anchor.y + anchor.height - SIZE;
  const canOpenUp = upwardTop >= topInset + MARGIN;
  let top = canOpenUp ? upwardTop : anchor.y;
  const maxTop = windowHeight - bottomInset - MARGIN - SIZE;
  if (top > maxTop) top = Math.max(topInset + MARGIN, maxTop);
  if (top < topInset + MARGIN) top = topInset + MARGIN;
  return { left, top };
}

export function PaletteButton({
  color,
  open,
  onOpenChange,
  onColor,
}: {
  color: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onColor: (color: string) => void;
}) {
  const ref = useRef<View>(null);
  const [anchor, setAnchor] = useState<Anchor | null>(null);
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const insets = useSafeAreaInsets();

  useEffect(() => {
    if (!open) return;
    ref.current?.measureInWindow((x, y, width, height) => setAnchor({ x, y, width, height }));
  }, [open]);

  const frame = open && anchor ? placeWheel(anchor, windowWidth, windowHeight, insets.top, insets.bottom) : null;

  return (
    <>
      <View ref={ref} collapsable={false}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Палитра цвета"
          accessibilityState={{ expanded: open }}
          onPress={() => onOpenChange(!open)}
          hitSlop={6}
          style={[styles.paletteBtn, { borderColor: color }]}
        >
          <Ionicons name="color-palette" size={22} color={color} />
        </Pressable>
      </View>
      <Modal visible={Boolean(frame)} transparent statusBarTranslucent animationType="fade" onRequestClose={() => onOpenChange(false)}>
        <View style={styles.overlay}>
          <Pressable accessibilityLabel="Закрыть палитру" style={[StyleSheet.absoluteFill, styles.backdrop]} onPress={() => onOpenChange(false)} />
          {frame ? (
            <View style={[styles.popover, frame]}>
              <ColorWheel color={color} onChange={onColor} />
            </View>
          ) : null}
        </View>
      </Modal>
    </>
  );
}

export function ColorWheel({ color, onChange }: { color: string; onChange: (color: string) => void }) {
  const pick = (x: number, y: number) => {
    const next = colorAt(x, y);
    if (next) onChange(next);
  };
  const spot = hexToHsv(color);
  const marker = spot
    ? {
        left: RADIUS + Math.cos((spot.h * Math.PI) / 180) * spot.s * RADIUS - 9,
        top: RADIUS + Math.sin((spot.h * Math.PI) / 180) * spot.s * RADIUS - 9,
      }
    : null;

  return (
    <View
      accessibilityLabel="Круг цвета"
      onStartShouldSetResponder={() => true}
      onMoveShouldSetResponder={() => true}
      onResponderGrant={(event) => pick(event.nativeEvent.locationX, event.nativeEvent.locationY)}
      onResponderMove={(event) => pick(event.nativeEvent.locationX, event.nativeEvent.locationY)}
      style={styles.wheel}
    >
      {CELLS.map((cell) => (
        <View key={`${cell.left}-${cell.top}`} pointerEvents="none" style={[styles.cell, { left: cell.left, top: cell.top, backgroundColor: cell.color }]} />
      ))}
      {marker ? <View pointerEvents="none" style={[styles.marker, marker]} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  paletteBtn: {
    width: 48,
    height: 48,
    borderRadius: radii.md,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
  },
  overlay: { flex: 1 },
  backdrop: { zIndex: 0 },
  popover: {
    position: 'absolute',
    zIndex: 1,
    width: SIZE,
    height: SIZE,
    borderRadius: RADIUS,
    elevation: 8,
    shadowColor: '#1A0830',
    shadowOpacity: 0.2,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
  },
  wheel: {
    width: SIZE,
    height: SIZE,
    borderRadius: RADIUS,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: colors.border,
    backgroundColor: colors.white,
  },
  cell: { position: 'absolute', width: STEP, height: STEP },
  marker: {
    position: 'absolute',
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 3,
    borderColor: colors.white,
    backgroundColor: 'transparent',
    shadowColor: '#1A0830',
  },
});
