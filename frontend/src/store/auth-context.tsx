import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { api, clearSession, readStoredUser, saveSession, type User } from '@/api/client';
import { warmStore } from '@/lib/kv';
import { getItem } from '@/lib/storage';

type Status = 'loading' | 'authed' | 'guest';

type AuthContextValue = {
  status: Status;
  user: User | null;
  isAuthenticating: boolean;
  register: (input: { name: string; email: string; password: string }) => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<Status>('loading');
  const [user, setUser] = useState<User | null>(null);
  const [isAuthenticating, setIsAuthenticating] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      const access = await getItem('accessToken');
      const stored = access ? await readStoredUser() : null;
      if (!access || !stored) {
        if (active) setStatus('guest');
        if (!access && stored) await clearSession();
        return;
      }
      await warmStore();
      if (!active) return;
      setUser(stored);
      setStatus('authed');
      try {
        const profile = await api.profile();
        if (!active) return;
        setUser(profile);
      } catch {
        if (!active) return;
        const still = await getItem('accessToken');
        const kept = still ? await readStoredUser() : null;
        if (kept) {
          setUser(kept);
          return;
        }
        setUser(null);
        setStatus('guest');
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      status,
      user,
      isAuthenticating,
      async register(input) {
        setIsAuthenticating(true);
        try {
          const session = await api.register(input);
          await saveSession(session);
          setUser(session.user);
          setStatus('authed');
        } finally {
          setIsAuthenticating(false);
        }
      },
      async login(email, password) {
        setIsAuthenticating(true);
        try {
          const session = await api.login({ email, password });
          await saveSession(session);
          setUser(session.user);
          setStatus('authed');
        } finally {
          setIsAuthenticating(false);
        }
      },
      async logout() {
        await api.logout();
        setUser(null);
        setStatus('guest');
      },
    }),
    [isAuthenticating, status, user],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth must be used inside AuthProvider');
  return value;
}
