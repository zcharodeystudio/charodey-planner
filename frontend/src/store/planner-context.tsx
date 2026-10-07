import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { ViewRange } from '@/lib/dates';
import { getItem, setItem } from '@/lib/storage';

export type SortMode = 'overdue' | 'time' | 'important' | null;
export type TaskScope = 'all' | 'favorites' | 'overdue' | 'untimed';
export type TaskLayout = 'list' | 'dates' | 'table';

export const SORTS: { id: Exclude<SortMode, null>; label: string }[] = [
  { id: 'overdue', label: 'Просроченные' },
  { id: 'time', label: 'По времени' },
  { id: 'important', label: 'По важности' },
];

type PlannerPrefs = {
  sort: SortMode;
  range: ViewRange;
  hideDone: boolean;
  listId: string | null;
  newOnTop: boolean;
  reorder: boolean;
  scope: TaskScope;
  layout: TaskLayout;
  rangeFrom: string | null;
  rangeTo: string | null;
};

type PlannerValue = PlannerPrefs & {
  apply: (patch: Partial<PlannerPrefs>) => void;
  setSort: (sort: SortMode) => void;
  setRange: (range: ViewRange) => void;
  setHideDone: (hide: boolean) => void;
  setListId: (id: string | null) => void;
  setNewOnTop: (value: boolean) => void;
  setReorder: (value: boolean) => void;
};

const PlannerContext = createContext<PlannerValue | null>(null);

function normalizeRange(value: unknown): ViewRange {
  if (value === 'all' || value === 'day' || value === 'week' || value === 'month' || value === 'custom') return value;
  if (value === 'quarter' || value === 'year') return 'month';
  return 'day';
}

function normalizeLayout(value: unknown, grouped?: boolean): TaskLayout {
  if (value === 'list' || value === 'dates' || value === 'table') return value;
  return grouped ? 'dates' : 'list';
}

function normalizeScope(value: unknown): TaskScope {
  if (value === 'favorites' || value === 'overdue' || value === 'untimed') return value;
  return 'all';
}

export function PlannerProvider({ children }: { children: React.ReactNode }) {
  const [sort, setSortState] = useState<SortMode>(null);
  const [range, setRangeState] = useState<ViewRange>('day');
  const [hideDone, setHideDoneState] = useState(false);
  const [listId, setListIdState] = useState<string | null>(null);
  const [newOnTop, setNewOnTopState] = useState(false);
  const [reorder, setReorderState] = useState(false);
  const [scope, setScopeState] = useState<TaskScope>('all');
  const [layout, setLayoutState] = useState<TaskLayout>('list');
  const [rangeFrom, setRangeFromState] = useState<string | null>(null);
  const [rangeTo, setRangeToState] = useState<string | null>(null);
  const current = { sort, range, hideDone, listId, newOnTop, reorder, scope, layout, rangeFrom, rangeTo };
  const prefsRef = useRef<PlannerPrefs>(current);
  prefsRef.current = current;

  useEffect(() => {
    void getItem('planner-prefs').then((raw) => {
      if (!raw) return;
      try {
        const saved = JSON.parse(raw) as Partial<PlannerPrefs> & { groupByDate?: boolean };
        if (saved.sort === null || saved.sort === 'overdue' || saved.sort === 'time' || saved.sort === 'important') setSortState(saved.sort);
        if (saved.range) setRangeState(normalizeRange(saved.range));
        if (typeof saved.hideDone === 'boolean') setHideDoneState(saved.hideDone);
        if (typeof saved.listId === 'string' || saved.listId === null) setListIdState(saved.listId ?? null);
        if (typeof saved.newOnTop === 'boolean') setNewOnTopState(saved.newOnTop);
        if (typeof saved.reorder === 'boolean') setReorderState(saved.reorder);
        if (saved.scope) setScopeState(normalizeScope(saved.scope));
        setLayoutState(normalizeLayout(saved.layout, saved.groupByDate));
        if (typeof saved.rangeFrom === 'string' || saved.rangeFrom === null) setRangeFromState(saved.rangeFrom ?? null);
        if (typeof saved.rangeTo === 'string' || saved.rangeTo === null) setRangeToState(saved.rangeTo ?? null);
      } catch {
        return;
      }
    });
  }, []);

  const value = useMemo<PlannerValue>(() => {
    const persist = (next: PlannerPrefs) => {
      void setItem('planner-prefs', JSON.stringify(next));
    };
    const apply = (patch: Partial<PlannerPrefs>) => {
      const next = { ...prefsRef.current, ...patch };
      prefsRef.current = next;
      setSortState(next.sort);
      setRangeState(next.range);
      setHideDoneState(next.hideDone);
      setListIdState(next.listId);
      setNewOnTopState(next.newOnTop);
      setReorderState(next.reorder);
      setScopeState(next.scope);
      setLayoutState(next.layout);
      setRangeFromState(next.rangeFrom);
      setRangeToState(next.rangeTo);
      persist(next);
    };
    return {
      ...current,
      apply,
      setSort: (next) => apply({ sort: next }),
      setRange: (next) => apply({ range: next }),
      setHideDone: (next) => apply({ hideDone: next }),
      setListId: (next) => apply({ listId: next }),
      setNewOnTop: (next) => apply({ newOnTop: next }),
      setReorder: (next) => apply({ reorder: next }),
    };
  }, [current.hideDone, current.layout, current.listId, current.newOnTop, current.range, current.rangeFrom, current.rangeTo, current.reorder, current.scope, current.sort]);

  return <PlannerContext.Provider value={value}>{children}</PlannerContext.Provider>;
}

export function usePlanner() {
  const value = useContext(PlannerContext);
  if (!value) throw new Error('usePlanner must be used inside PlannerProvider');
  return value;
}
