import { Redirect } from 'expo-router';
import { useEffect, useState } from 'react';
import { ScreenLoader } from '@/components/ui/screen';
import { getLastTab, tabHref, type AppTab } from '@/lib/last-tab';
import { useAuth } from '@/store/auth-context';

export default function Index() {
  const { status } = useAuth();
  const [tab, setTab] = useState<AppTab | null>(null);

  useEffect(() => {
    if (status !== 'authed') return;
    void getLastTab().then(setTab);
  }, [status]);

  if (status === 'loading' || (status === 'authed' && !tab)) return <ScreenLoader />;
  if (status === 'authed' && tab) return <Redirect href={tabHref(tab)} />;
  return <Redirect href="/(auth)/welcome" />;
}
