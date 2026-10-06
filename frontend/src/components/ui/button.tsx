import { ActivityIndicator, Pressable, StyleSheet, Text } from 'react-native';
import { colors, radii, spacing } from '@/theme/theme';

type Variant = 'primary' | 'secondary' | 'danger';

type ButtonProps = {
  title: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
  variant?: Variant;
};

export function Button({ title, onPress, loading, disabled, variant = 'primary' }: ButtonProps) {
  const blocked = disabled || loading;
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      disabled={blocked}
      style={({ pressed }) => [
        styles.base,
        variant === 'primary' && styles.primary,
        variant === 'secondary' && styles.secondary,
        variant === 'danger' && styles.danger,
        pressed && !blocked && styles.pressed,
        blocked && styles.disabled,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={variant === 'primary' ? colors.white : colors.primary} />
      ) : (
        <Text
          style={[
            styles.label,
            variant === 'primary' && styles.primaryLabel,
            variant === 'secondary' && styles.secondaryLabel,
            variant === 'danger' && styles.dangerLabel,
          ]}
        >
          {title}
        </Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: 52,
    borderRadius: radii.lg,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
  },
  primary: {
    backgroundColor: colors.primary,
  },
  secondary: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
  },
  danger: {
    backgroundColor: colors.errorMuted,
  },
  pressed: {
    opacity: 0.86,
    transform: [{ scale: 0.985 }],
  },
  disabled: {
    opacity: 0.55,
  },
  label: {
    fontSize: 16,
    fontWeight: '700',
  },
  primaryLabel: {
    color: colors.white,
  },
  secondaryLabel: {
    color: colors.text,
  },
  dangerLabel: {
    color: colors.error,
  },
});
