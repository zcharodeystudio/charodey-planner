import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInRight } from 'react-native-reanimated';
import { Screen } from '@/components/ui/screen';
import { useTheme } from '@/store/theme-context';
import { colors, radii, spacing } from '@/theme/theme';

type AuthScreenProps = {
  title: string;
  subtitle?: string;
  step?: number;
  totalSteps?: number;
  onBack?: () => void;
  onHome?: () => void;
  footer?: React.ReactNode;
  children: React.ReactNode;
};

export function AuthScreen({
  title,
  subtitle,
  step,
  totalSteps,
  onBack,
  onHome,
  footer,
  children,
}: AuthScreenProps) {
  const theme = useTheme();
  return (
    <Screen>
      <View style={styles.body}>
        <View style={styles.top}>
          {onBack ? (
            <Pressable onPress={onBack} hitSlop={12} style={styles.iconButton}>
              <Ionicons name="chevron-back" size={26} color={colors.text} />
            </Pressable>
          ) : (
            <View style={styles.iconButton} />
          )}
          {onHome ? (
            <Pressable onPress={onHome} hitSlop={12} style={styles.iconButton}>
              <Ionicons name="home-outline" size={22} color={colors.text} />
            </Pressable>
          ) : (
            <View style={styles.iconButton} />
          )}
        </View>

        {step && totalSteps ? (
          <View style={styles.progress}>
            {Array.from({ length: totalSteps }, (_, index) => (
              <View key={index} style={[styles.bar, index < step ? { backgroundColor: theme.primary } : null]} />
            ))}
          </View>
        ) : null}

        <Animated.View key={`${title}-${step ?? 0}`} entering={FadeInRight.duration(280)} style={styles.content}>
          <Text style={styles.title}>{title}</Text>
          {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
          <View style={styles.form}>{children}</View>
        </Animated.View>
        {footer}
      </View>
    </Screen>
  );
}

export function AuthFooter({
  prompt,
  action,
  onPress,
}: {
  prompt: string;
  action: string;
  onPress: () => void;
}) {
  const theme = useTheme();
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={styles.footerLink}>
      <Text style={styles.prompt}>
        {prompt} <Text style={[styles.action, { color: theme.primary }]}>{action}</Text>
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  body: {
    flex: 1,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
  },
  top: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    minHeight: 44,
    alignItems: 'center',
  },
  iconButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  progress: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  bar: {
    flex: 1,
    height: 4,
    borderRadius: radii.full,
    backgroundColor: colors.border,
  },
  content: {
    flex: 1,
    gap: spacing.md,
  },
  title: {
    fontSize: 28,
    lineHeight: 34,
    fontWeight: '800',
    color: colors.text,
  },
  subtitle: {
    fontSize: 16,
    lineHeight: 22,
    color: colors.textSecondary,
  },
  form: {
    marginTop: spacing.sm,
    gap: spacing.md,
  },
  footerLink: {
    alignItems: 'center',
    paddingVertical: spacing.sm,
  },
  prompt: {
    color: colors.textSecondary,
    fontSize: 15,
  },
  action: {
    fontWeight: '700',
  },
});
