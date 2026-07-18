import { useCallback, useEffect, useRef, useState } from 'react';

// A localStorage-backed React state hook. Keeps everything on the laptop:
// no cloud DB, no network calls. Falls back to the initial value if storage
// is unavailable or the stored JSON is corrupt.
export function useLocalStorage<T>(key: string, initialValue: T) {
  const [value, setValue] = useState<T>(() => {
    if (typeof window === 'undefined') return initialValue;
    try {
      const raw = window.localStorage.getItem(key);
      return raw ? (JSON.parse(raw) as T) : initialValue;
    } catch {
      return initialValue;
    }
  });

  // Avoid writing on the first render (value came from storage already).
  const isFirst = useRef(true);

  useEffect(() => {
    if (isFirst.current) {
      isFirst.current = false;
      return;
    }
    try {
      window.localStorage.setItem(key, JSON.stringify(value));
    } catch {
      // Quota or serialization errors are non-fatal for a local prototype.
    }
  }, [key, value]);

  const reset = useCallback(() => setValue(initialValue), [initialValue]);

  return [value, setValue, reset] as const;
}
