type Listener = (message: string) => void;

let listener: Listener | null = null;

export function showToast(message: string) {
  listener?.(message);
}

export function subscribeToast(next: Listener) {
  listener = next;
  return () => {
    if (listener === next) listener = null;
  };
}
