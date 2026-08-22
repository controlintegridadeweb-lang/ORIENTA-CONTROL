import { useEffect, useState } from "react";

/**
 * Retorna `value` atrasado por `delayMs` (debounce). Util para busca textual
 * que dispara requisicoes sem um fetch por keystroke.
 */
export function useDebounce<T>(value: T, delayMs = 250): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const id = window.setTimeout(() => setDebounced(value), delayMs);
    return () => window.clearTimeout(id);
  }, [value, delayMs]);

  return debounced;
}
