import { Ionicons } from '@expo/vector-icons';
import { Href, router, useNavigation } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import { colors } from '@/theme/theme';

export function goBack(fallback?: Href) {
  if (router.canGoBack()) {
    router.back();
    return;
  }
  if (fallback) router.navigate(fallback);
}

export function BackButton({ label, fallback }: { label: string; fallback?: Href }) {
  const navigation = useNavigation();
  const [canBack, setCanBack] = useState(() => router.canGoBack());

  useEffect(() => {
    const sync = () => setCanBack(router.canGoBack());
    sync();
    return navigation.addListener('state', sync);
  }, [navigation]);

  if (!canBack && !fallback) return null;

  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} hitSlop={12} onPress={() => goBack(fallback)} style={styles.back}>
      <Ionicons name="chevron-back" size={26} color={colors.text} />
      <Text style={styles.text}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  back: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', minHeight: 40 },
  text: { fontSize: 16, fontWeight: '700', color: colors.text },
});
