// G52 — the value, `delayMs` after it last changed. The search box updates on every
// keystroke; the list it drives only re-filters once typing pauses.
import { useEffect, useState } from 'react';

export function useDebouncedValue(value, delayMs = 150) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(t);
  }, [value, delayMs]);
  return debounced;
}
