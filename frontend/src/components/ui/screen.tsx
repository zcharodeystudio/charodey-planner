import { useEffect, useRef } from 'react';
import { Animated, Image, StyleSheet, View, type ViewStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors } from '@/theme/theme';

export function Screen({ children, style }: { children: React.ReactNode; style?: ViewStyle }) {
  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <View style={[styles.frame, style]}>{children}</View>
    </SafeAreaView>
  );
}

export function ScreenLoader() {
  const pulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(Animated.timing(pulse, { toValue: 1, duration: 1800, useNativeDriver: true }));
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  const ring = (offset: number, size: number) => ({
    width: size,
    height: size,
    borderRadius: size / 2,
    opacity: pulse.interpolate({ inputRange: [0, 0.7, 1], outputRange: [0.55 - offset, 0, 0] }),
    transform: [{ scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.72 + offset, 1.35 + offset] }) }],
  });

  return (
    <View style={styles.loader}>
      <Animated.View style={[styles.ring, ring(0, 220)]} />
      <Animated.View style={[styles.ring, ring(0.18, 280)]} />
      <Image source={require('../../../assets/icon.png')} style={styles.logo} />
    </View>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.background,
  },
  frame: {
    flex: 1,
    width: '100%',
    maxWidth: 430,
    alignSelf: 'center',
  },
  loader: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#3B1464',
  },
  ring: {
    position: 'absolute',
    borderWidth: 2,
    borderColor: '#E8B423',
  },
  logo: { width: 168, height: 168 },
});
