import { useEffect, useRef } from 'react';
import { Animated, StyleSheet, View, type DimensionValue, type ViewStyle } from 'react-native';
import { Screen } from '@/components/ui/screen';
import { colors, radii, spacing } from '@/theme/theme';

export function SkeletonBlock({ width = '100%', height = 16, radius = radii.md, style }: { width?: DimensionValue; height?: number; radius?: number; style?: ViewStyle }) {
  const opacity = useRef(new Animated.Value(0.45)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 1, duration: 700, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.45, duration: 700, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [opacity]);

  return <Animated.View style={[{ width, height, borderRadius: radius, backgroundColor: '#D9C6EE', opacity }, style]} />;
}

export function PageSkeleton() {
  return (
    <Screen>
      <View style={styles.page}>
        <SkeletonBlock width={120} height={18} />
        <SkeletonBlock width="70%" height={28} />
        <SkeletonBlock height={72} />
        <SkeletonBlock height={72} />
        <SkeletonBlock width="85%" height={18} />
        <SkeletonBlock height={48} />
      </View>
    </Screen>
  );
}

export function TaskCardSkeleton() {
  return (
    <View style={styles.card}>
      <SkeletonBlock width={22} height={22} radius={6} />
      <View style={styles.copy}>
        <SkeletonBlock width="75%" height={16} />
        <SkeletonBlock width="40%" height={12} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { padding: spacing.lg, gap: spacing.md },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    minHeight: 64,
    padding: spacing.md,
    borderRadius: radii.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  copy: { flex: 1, gap: 8 },
});
