import { getItem, setItem } from '@/lib/storage';

export type AppTab = 'profile' | 'today';

const KEY = 'last-tab';

export async function getLastTab(): Promise<AppTab> {
  const value = await getItem(KEY);
  return value === 'today' ? 'today' : 'profile';
}

export function tabHref(tab: AppTab) {
  return tab === 'today' ? '/(app)/(tabs)/today' : '/(app)/(tabs)/profile';
}

export async function rememberTab(pathname: string) {
  if (pathname.includes('profile')) await setItem(KEY, 'profile');
  else if (pathname.includes('today')) await setItem(KEY, 'today');
}
