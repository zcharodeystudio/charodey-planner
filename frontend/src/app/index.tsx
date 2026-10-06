import { Redirect } from 'expo-router';
import { ScreenLoader } from '@/components/ui/screen';
import { useAuth } from '@/store/auth-context';

export default function Index() {
  const { status } = useAuth();
  if (status === 'loading') return <ScreenLoader />;
  if (status === 'authed') return <Redirect href="/(app)/(tabs)/today" />;
  return <Redirect href="/(auth)/welcome" />;
}
