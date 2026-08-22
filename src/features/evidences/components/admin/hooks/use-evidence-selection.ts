"use client";

import { useCallback, useMemo, useState } from "react";

export function useEvidenceSelection() {
  const [selected, setSelected] = useState<Set<string>>(() => new Set());

  const toggle = useCallback((id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const clear = useCallback(() => setSelected(new Set()), []);

  const toggleAllOnPage = useCallback((pageIds: string[]) => {
    setSelected((prev) => {
      const allThere =
        pageIds.length > 0 && pageIds.every((id) => prev.has(id));
      const next = new Set(prev);
      if (allThere) {
        for (const id of pageIds) next.delete(id);
      } else {
        for (const id of pageIds) next.add(id);
      }
      return next;
    });
  }, []);

  const selectedIds = useMemo(() => Array.from(selected), [selected]);

  const isAllOnPage = useCallback(
    (pageIds: string[]) =>
      pageIds.length > 0 && pageIds.every((id) => selected.has(id)),
    [selected],
  );

  return useMemo(
    () => ({
      selected,
      selectedIds,
      toggle,
      clear,
      toggleAllOnPage,
      isAllOnPage,
    }),
    [selected, selectedIds, toggle, clear, toggleAllOnPage, isAllOnPage],
  );
}
