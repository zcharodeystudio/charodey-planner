import { Ionicons } from '@expo/vector-icons';
import { useEffect } from 'react';
import { StyleSheet, Text, type StyleProp, type TextStyle } from 'react-native';
import Animated, { interpolate, useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { useTheme } from '@/store/theme-context';
import { colors } from '@/theme/theme';

const SPRING = { damping: 12, stiffness: 260, mass: 0.55 };

export function DoneMark({ done, color, size = 26, radius }: { done: boolean; color: string; size?: number; radius?: number }) {
  const theme = useTheme();
  const progress = useSharedValue(done ? 1 : 0);

  useEffect(() => {
    progress.value = withSpring(done ? 1 : 0, SPRING);
  }, [done, progress]);

  const ring = useAnimatedStyle(() => ({
    transform: [{ scale: interpolate(progress.value, [0, 0.45, 1], [1, 1.16, 1]) }],
  }));
  const fill = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [{ scale: 0.55 + progress.value * 0.45 }],
  }));
  const icon = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [{ scale: interpolate(progress.value, [0, 1], [0.3, 1]) }],
  }));

  const boxRadius = radius ?? Math.round(size * 0.32);
  return (
    <Animated.View style={[styles.box, { width: size, height: size, borderRadius: boxRadius, borderColor: done ? '#C084FC' : color }, ring]}>
      <Animated.View style={[styles.fill, { backgroundColor: color, borderRadius: boxRadius }, fill]} />
      <Animated.View style={icon}>
        <Ionicons name="checkmark" size={Math.round(size * 0.62)} color={theme.onPrimary} />
      </Animated.View>
    </Animated.View>
  );
}

export function DoneTitle({
  done,
  text,
  style,
  numberOfLines = 2,
}: {
  done: boolean;
  text: string;
  style?: StyleProp<TextStyle>;
  numberOfLines?: number;
}) {
  return (
    <Text numberOfLines={numberOfLines} style={[styles.titleText, style, done && styles.done]}>
      {text}
    </Text>
  );
}

const styles = StyleSheet.create({
  box: {
    borderWidth: 2.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fill: {
    ...StyleSheet.absoluteFill,
  },
  titleText: { flexShrink: 1, minWidth: 0 },
  done: { color: colors.inkMuted, textDecorationLine: 'line-through' },
});
