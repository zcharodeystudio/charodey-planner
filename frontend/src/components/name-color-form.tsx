import { StyleSheet, TextInput, View } from 'react-native';
import { PaletteButton } from '@/components/color-wheel';
import { Button } from '@/components/ui/button';
import { colors, radii, spacing } from '@/theme/theme';

export function NameColorForm({
  placeholder,
  value,
  onChangeText,
  color,
  paletteOpen,
  onPaletteOpen,
  onColor,
  onCancel,
  onSubmit,
}: {
  placeholder: string;
  value: string;
  onChangeText: (value: string) => void;
  color: string;
  paletteOpen: boolean;
  onPaletteOpen: (open: boolean) => void;
  onColor: (color: string) => void;
  onCancel: () => void;
  onSubmit: () => void;
}) {
  return (
    <View style={styles.create}>
      <View style={styles.nameRow}>
        <TextInput
          value={value}
          onChangeText={onChangeText}
          onSubmitEditing={onSubmit}
          autoFocus
          placeholder={placeholder}
          placeholderTextColor={colors.inkMuted}
          style={[styles.input, styles.flex]}
        />
        <PaletteButton color={color} open={paletteOpen} onOpenChange={onPaletteOpen} onColor={onColor} />
      </View>
      <View style={styles.actions}>
        <View style={styles.flex}>
          <Button title="Отмена" variant="secondary" onPress={onCancel} />
        </View>
        <View style={styles.flex}>
          <Button title="Создать" onPress={onSubmit} />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  create: { gap: spacing.sm },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  flex: { flex: 1 },
  actions: { flexDirection: 'row', gap: spacing.sm },
  input: {
    minHeight: 48,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    color: colors.ink,
    backgroundColor: colors.surface,
  },
});
