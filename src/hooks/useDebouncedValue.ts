import { useEffect, useState } from "react";

/** Debounce any rapidly-changing value (e.g. search input) by `delay` ms (default 300). */
export function useDebouncedValue<T>(value: T, delay = 300): T {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return v;
}
