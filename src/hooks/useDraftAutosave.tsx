import { useEffect, useRef, useState, useCallback } from "react";

interface DraftMeta<T> {
  data: T;
  savedAt: number;
}

interface Options {
  /** Unique key (will be prefixed with `draft:`). */
  key: string;
  /** Debounce in ms before writing to localStorage. Default 1000. */
  debounceMs?: number;
  /** Disable autosave (e.g. while submitting). */
  enabled?: boolean;
}

/**
 * Generic localStorage-backed form draft autosave.
 *
 * Usage:
 *   const { existingDraft, save, clear } = useDraftAutosave({ key: "sales-invoice", enabled: dialogOpen });
 *   useEffect(() => { save({ customerId, items, ... }); }, [customerId, items]);
 *   // On submit success: clear();
 *   // On mount: if (existingDraft) show restore banner.
 */
export function useDraftAutosave<T>(opts: Options) {
  const { key, debounceMs = 1000, enabled = true } = opts;
  const storageKey = `draft:${key}`;
  const timer = useRef<number | null>(null);

  const [existingDraft, setExistingDraft] = useState<DraftMeta<T> | null>(() => {
    if (typeof window === "undefined") return null;
    try {
      const raw = localStorage.getItem(storageKey);
      return raw ? (JSON.parse(raw) as DraftMeta<T>) : null;
    } catch { return null; }
  });

  const save = useCallback((data: T) => {
    if (!enabled) return;
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => {
      try {
        const payload: DraftMeta<T> = { data, savedAt: Date.now() };
        localStorage.setItem(storageKey, JSON.stringify(payload));
      } catch { /* quota or serialisation error — ignore */ }
    }, debounceMs);
  }, [enabled, debounceMs, storageKey]);

  /** Synchronously write the latest draft. Use on visibilitychange / beforeunload. */
  const flush = useCallback((data: T) => {
    if (!enabled) return;
    if (timer.current) { window.clearTimeout(timer.current); timer.current = null; }
    try {
      const payload: DraftMeta<T> = { data, savedAt: Date.now() };
      localStorage.setItem(storageKey, JSON.stringify(payload));
      setExistingDraft(payload);
    } catch { /* ignore */ }
  }, [enabled, storageKey]);

  const clear = useCallback(() => {
    if (timer.current) window.clearTimeout(timer.current);
    try { localStorage.removeItem(storageKey); } catch { /* ignore */ }
    setExistingDraft(null);
  }, [storageKey]);

  // Cleanup pending timer on unmount
  useEffect(() => () => { if (timer.current) window.clearTimeout(timer.current); }, []);

  return { existingDraft, save, flush, clear };
}
