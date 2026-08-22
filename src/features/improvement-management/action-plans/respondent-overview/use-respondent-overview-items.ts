"use client";

import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import type { ActionPlanListItem } from "@/features/improvement-management/action-plans/types";
import {
  getRespondentOverviewCacheVersion,
  getRespondentOverviewItems,
  invalidateRespondentOverviewCache,
  subscribeRespondentOverviewCache,
} from "./cache";
import { useLatestRequestGuard } from "@/shared/hooks/use-latest-request-guard";

export function useRespondentOverviewItems() {
  const version = useSyncExternalStore(
    subscribeRespondentOverviewCache,
    getRespondentOverviewCacheVersion,
    getRespondentOverviewCacheVersion,
  );
  const [items, setItems] = useState<ActionPlanListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { begin, isLatest } = useLatestRequestGuard();

  const load = useCallback(async (force?: boolean) => {
    const requestId = begin();
    setLoading(true);
    setError(null);
    try {
      const rows = await getRespondentOverviewItems({ force });
      if (isLatest(requestId)) setItems(rows);
    } catch (e) {
      if (isLatest(requestId)) {
        setError(e instanceof Error ? e.message : "Falha ao carregar dados.");
      }
    } finally {
      if (isLatest(requestId)) setLoading(false);
    }
  }, [begin, isLatest]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- Inicia a leitura assíncrona da API para o escopo atual; os setters ocorrem na continuação da requisição.
    void load();
  }, [load, version]);

  const refetch = useCallback(async () => {
    invalidateRespondentOverviewCache();
    await load(true);
  }, [load]);

  return useMemo(
    () => ({ items, loading, error, refetch }),
    [items, loading, error, refetch],
  );
}
