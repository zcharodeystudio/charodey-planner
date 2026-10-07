import { Ionicons } from '@expo/vector-icons';
import { useCallback, useMemo, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { runOnJS, useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import { colors, radii } from '@/theme/theme';

const TRIGGER = 96;
const SPRING = { damping: 18, stiffness: 240, mass: 0.7 };

export function SwipeToDelete({
  children,
  onDelete,
  rounded = true,
}: {
  children: React.ReactNode;
  onDelete: () => void;
  rounded?: boolean;
}) {
  const x = useSharedValue(0);
  const width = useSharedValue(0);
  const deleting = useSharedValue(false);
  const removed = useRef(false);
  const onDeleteRef = useRef(onDelete);
  onDeleteRef.current = onDelete;

  const commit = useCallback(() => {
    setTimeout(() => {
      if (removed.current) return;
      removed.current = true;
      onDeleteRef.current();
    }, 190);
  }, []);

  const pan = useMemo(
    () =>
      Gesture.Pan()
        .activeOffsetX(-14)
        .failOffsetY([-16, 16])
        .onUpdate((event) => {
          if (deleting.value) return;
          x.value = Math.min(0, event.translationX);
        })
        .onEnd(() => {
          if (deleting.value) return;
          if (x.value <= -TRIGGER) {
            deleting.value = true;
            x.value = withTiming(-Math.max(width.value, 320), { duration: 180 });
            runOnJS(commit)();
          }
        })
        .onFinalize(() => {
          if (deleting.value) return;
          if (x.value < -1) x.value = withSpring(0, SPRING);
        }),
    [commit, deleting, width, x],
  );

  const rowStyle = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }] }));
  const iconStyle = useAnimatedStyle(() => {
    const progress = Math.min(1, Math.abs(x.value) / TRIGGER);
    return { opacity: progress, transform: [{ scale: 0.65 + progress * 0.35 }] };
  });

  return (
    <View
      style={[styles.wrap, rounded && styles.rounded]}
      onLayout={(event) => {
        width.value = event.nativeEvent.layout.width;
      }}
    >
      <View pointerEvents="none" style={styles.behind}>
        <Animated.View style={iconStyle}>
          <Ionicons name="trash" size={22} color={colors.white} />
        </Animated.View>
      </View>
      <GestureDetector gesture={pan}>
        <Animated.View style={rowStyle}>{children}</Animated.View>
      </GestureDetector>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { overflow: 'hidden' },
  rounded: { borderRadius: radii.lg },
  behind: {
    ...StyleSheet.absoluteFill,
    backgroundColor: colors.error,
    alignItems: 'flex-end',
    justifyContent: 'center',
    paddingRight: 22,
  },
});
