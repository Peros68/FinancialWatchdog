import { useEffect, useState } from "react";

/**
 * Persisted state backed by localStorage. Mirrors useState, but the value is
 * read on mount and written on every change under `key`. Failures (private mode,
 * quota, SSR) degrade gracefully to in-memory state.
 */
export function useLocalStorage<T>(key: string, initial: T) {
  const [value, setValue] = useState<T>(() => {
    try {
      const raw = typeof window !== "undefined" ? window.localStorage.getItem(key) : null;
      return raw != null ? (JSON.parse(raw) as T) : initial;
    } catch {
      return initial;
    }
  });

  useEffect(() => {
    try {
      window.localStorage.setItem(key, JSON.stringify(value));
    } catch {
      /* ignore persistence errors */
    }
  }, [key, value]);

  return [value, setValue] as const;
}
