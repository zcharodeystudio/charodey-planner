import { Redirect, Stack } from 'expo-router';
import { ScreenLoader } from '@/components/ui/screen';
import { DateProvider } from '@/store/date-context';
import { PlannerProvider } from '@/store/planner-context';
import { useAuth } from '@/store/auth-context';

export default function AppLayout() {
  const { status } = useAuth();
  if (status === 'loading') return <ScreenLoader />;
  if (status !== 'authed') return <Redirect href="/(auth)/welcome" />;

  return (
    <DateProvider>
      <PlannerProvider>
        <Stack screenOptions={{ headerShown: false, animation: 'slide_from_right' }}>
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="task/[id]" options={{ animation: 'slide_from_bottom' }} />
        <Stack.Screen name="favorites" />
        </Stack>
      </PlannerProvider>
    </DateProvider>
  );
}
