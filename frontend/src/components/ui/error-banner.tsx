import { StyleSheet, Text } from 'react-native';
import { colors, radii, spacing } from '@/theme/theme';

export function ErrorBanner({ message }: { message?: string | null }) {
  if (!message) return null;
  return <Text style={styles.banner}>{message}</Text>;
}

const styles = StyleSheet.create({
  banner: {
    backgroundColor: colors.errorMuted,
    color: colors.error,
    borderRadius: radii.md,
    padding: spacing.md,
    overflow: 'hidden',
  },
});
