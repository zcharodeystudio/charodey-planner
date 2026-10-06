import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { api, clearSession, readStoredUser, saveSession, type User } from '@/api/client';
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
      if (!access) {
        if (active) setStatus('guest');
        return;
      }
      try {
        const profile = await api.profile();
        if (!active) return;
        setUser(profile);
        setStatus('authed');
      } catch {
        const stored = await readStoredUser();
        if (!active) return;
        if (stored && (await getItem('accessToken'))) {
          setUser(stored);
          setStatus('authed');
          return;
        }
        await clearSession();
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
