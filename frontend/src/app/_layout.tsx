import { Href, Stack, usePathname, useRouter } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef } from 'react';
import { BackHandler, Platform, StyleSheet } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ToastHost } from '@/components/toast-host';
import { configureNotifications } from '@/lib/notifications';
import { colors } from '@/theme/theme';
import { AuthProvider, useAuth } from '@/store/auth-context';
import { ThemeProvider } from '@/store/theme-context';

SplashScreen.preventAutoHideAsync().catch(() => undefined);

function AndroidBackNavigation() {
  const router = useRouter();
  const pathname = usePathname();
  const pathnameRef = useRef(pathname);
  pathnameRef.current = pathname;

  useEffect(() => {
    if (Platform.OS !== 'android') return;
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      const path = pathnameRef.current;
      if (path.includes('/task') || path.includes('/favorites') || path.includes('/login') || path.includes('/register')) {
        if (router.canGoBack()) router.back();
        else if (path.includes('/login') || path.includes('/register')) router.replace('/(auth)/welcome' as Href);
        else router.replace('/(app)/(tabs)/today' as Href);
        return true;
      }
      if (path.includes('/today')) {
        router.navigate('/(app)/(tabs)/profile' as Href);
        return true;
      }
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
        <ThemeProvider>
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
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
});
