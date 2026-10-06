import { createContext, useContext, useMemo, useState } from 'react';
import { todayISO } from '@/lib/dates';

type DateContextValue = {
  date: string;
  setDate: (date: string) => void;
};

const DateContext = createContext<DateContextValue | null>(null);

export function DateProvider({ children }: { children: React.ReactNode }) {
  const [date, setDate] = useState(todayISO);
  const value = useMemo(() => ({ date, setDate }), [date]);
  return <DateContext.Provider value={value}>{children}</DateContext.Provider>;
}

export function useSelectedDate() {
  const value = useContext(DateContext);
  if (!value) throw new Error('useSelectedDate must be used inside DateProvider');
  return value;
}
