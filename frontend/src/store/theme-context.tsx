import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { colors } from '@/theme/theme';
import { getItem, setItem } from '@/lib/storage';

export const ACCENTS = [
  { id: 'gold', label: 'Золото', primary: '#E8B423', primaryPressed: '#C49212', primaryMuted: '#F8E7B8', onPrimary: '#3A2614' },
  { id: 'violet', label: 'Аметист', primary: '#A855F7', primaryPressed: '#7C3AED', primaryMuted: '#EDE4FF', onPrimary: '#FFFFFF' },
  { id: 'blue', label: 'Сапфир', primary: '#60A5FA', primaryPressed: '#2563EB', primaryMuted: '#DBEAFE', onPrimary: '#FFFFFF' },
  { id: 'orange', label: 'Янтарь', primary: '#F59E0B', primaryPressed: '#D97706', primaryMuted: '#FEF3C7', onPrimary: '#3A2614' },
  { id: 'rose', label: 'Роза', primary: '#F472B6', primaryPressed: '#DB2777', primaryMuted: '#FCE7F3', onPrimary: '#FFFFFF' },
] as const;

export type AccentId = (typeof ACCENTS)[number]['id'];

type ThemeValue = {
  primary: string;
  primaryPressed: string;
  primaryMuted: string;
  onPrimary: string;
  accentId: AccentId;
  setAccentId: (id: AccentId) => void;
};

const fallback = ACCENTS[0];
const ThemeContext = createContext<ThemeValue>({
  primary: fallback.primary,
  primaryPressed: fallback.primaryPressed,
  primaryMuted: fallback.primaryMuted,
  onPrimary: fallback.onPrimary,
  accentId: fallback.id,
  setAccentId: () => undefined,
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [accentId, setAccentIdState] = useState<AccentId>(fallback.id);

  useEffect(() => {
    void getItem('accent').then((saved) => {
      if (ACCENTS.some((item) => item.id === saved)) setAccentIdState(saved as AccentId);
    });
  }, []);

  const value = useMemo<ThemeValue>(() => {
    const accent = ACCENTS.find((item) => item.id === accentId) ?? fallback;
    return {
      primary: accent.primary,
      primaryPressed: accent.primaryPressed,
      primaryMuted: accent.primaryMuted,
      onPrimary: accent.onPrimary,
      accentId: accent.id,
      setAccentId: (id) => {
        setAccentIdState(id);
        void setItem('accent', id);
      },
    };
  }, [accentId]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const theme = useContext(ThemeContext);
  return { ...colors, ...theme };
}
