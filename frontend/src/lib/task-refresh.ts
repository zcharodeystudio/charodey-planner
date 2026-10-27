import { useEffect, useState } from 'react';

const ids = new Set<string>();
let pendingNew = false;
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((listener) => listener());
}

export function markTaskRefreshing(id: string) {
  ids.add(id);
  emit();
}

export function markNewTaskRefreshing() {
  pendingNew = true;
  emit();
}

export function clearTaskRefreshing() {
  if (!ids.size && !pendingNew) return;
  ids.clear();
  pendingNew = false;
  emit();
}

export function useTaskRefresh() {
  const [state, setState] = useState({ ids: [...ids], pendingNew });
  useEffect(() => {
    const listener = () => setState({ ids: [...ids], pendingNew });
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }, []);
  return state;
}
