import { Stack, useRouter } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { BackHandler, Platform, StyleSheet } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ToastHost } from '@/components/toast-host';
import { configureNotifications } from '@/lib/notifications';
import { AuthProvider, useAuth } from '@/store/auth-context';

SplashScreen.preventAutoHideAsync().catch(() => undefined);

function AndroidBackNavigation() {
  const router = useRouter();
  useEffect(() => {
    if (Platform.OS !== 'android') return;
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      if (!router.canGoBack()) return false;
      router.back();
      return true;
    });
    return () => subscription.remove();
  }, [router]);
  return null;
}

function SplashGate({ children }: { children: React.ReactNode }) {
  const { status } = useAuth();
  useEffect(() => {
    if (status !== 'loading') SplashScreen.hideAsync().catch(() => undefined);
  }, [status]);
  return children;
}

export default function RootLayout() {
  useEffect(() => {
    void configureNotifications();
  }, []);

  return (
    <GestureHandlerRootView style={styles.root}>
      <SafeAreaProvider>
        <AuthProvider>
          <SplashGate>
            <AndroidBackNavigation />
            <StatusBar style="dark" />
            <Stack screenOptions={{ headerShown: false, animation: 'fade' }}>
              <Stack.Screen name="index" />
              <Stack.Screen name="(auth)" />
              <Stack.Screen name="(app)" />
            </Stack>
            <ToastHost />
          </SplashGate>
        </AuthProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
});
