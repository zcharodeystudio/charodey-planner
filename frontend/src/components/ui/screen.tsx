import { ActivityIndicator, StyleSheet, View, type ViewStyle } from 'react-native';
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
  return (
    <Screen>
      <View style={styles.loader}>
        <ActivityIndicator color={colors.primary} size="large" />
      </View>
    </Screen>
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
  },
});
