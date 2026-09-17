import { useState, useEffect, useCallback, useRef } from "react";

export function useDraftState<T>(key: string, initial: T) {
  const initialRef = useRef(initial);

  const readDraft = useCallback((): T => {
    if (typeof window === "undefined") return initialRef.current;
    try {
      const stored = localStorage.getItem(key);
      return stored ? JSON.parse(stored) : initialRef.current;
    } catch {
      return initialRef.current;
    }
  }, [key]);

  const [state, setState] = useState<T>(() => {
    return readDraft();
  });

  const keyRef = useRef(key);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (keyRef.current === key) {
      localStorage.setItem(key, JSON.stringify(state));
    }
    keyRef.current = key;
  }, [key, state]);

  useEffect(() => {
    setState(readDraft());
  }, [readDraft]);

  useEffect(() => {
    const handler = (e: StorageEvent) => {
      if (e.key === key && e.newValue) {
        try { setState(JSON.parse(e.newValue)); } catch {}
        return;
      }
      if (!e.key) setState(readDraft());
    };
    window.addEventListener("storage", handler);
    return () => window.removeEventListener("storage", handler);
  }, [key, readDraft]);

  const clear = useCallback(() => {
    if (typeof window === "undefined") return;
    localStorage.removeItem(key);
    setState(initialRef.current);
  }, [key]);

  return [state, setState, clear] as const;
}
