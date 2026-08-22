"use client";

import { useCallback, useEffect, useState } from "react";
import {
  getRespondentEvidenceStats,
  type RespondentEvidenceFilters,
} from "@/features/evidences/respondent-client";
import type { RespondentStatsResult } from "@/features/evidences/respondent-service";
import { describeError } from "@/infrastructure/notifications/notify";
import { useLatestRequestGuard } from "@/shared/hooks/use-latest-request-guard";

type FilterSlice = Pick<
  RespondentEvidenceFilters,
  "cycleId" | "formId" | "search" | "axisName" | "sectionName"
>;

export function useRespondentStats(filters: FilterSlice) {
  const [stats, setStats] = useState<RespondentStatsResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { begin, isLatest } = useLatestRequestGuard();

  const { cycleId, formId, search, axisName, sectionName } = filters;

  const fetchStats = useCallback(async () => {
    const requestId = begin();
    setLoading(true);
    setError(null);
    try {
      const nextStats = await getRespondentEvidenceStats({
        cycleId,
        formId,
        search,
        axisName,
        sectionName,
      });
      if (isLatest(requestId)) setStats(nextStats);
    } catch (caught) {
      if (isLatest(requestId)) {
        setError(describeError(caught, "Falha ao carregar os indicadores de evidências."));
      }
    } finally {
      if (isLatest(requestId)) setLoading(false);
    }
  }, [cycleId, formId, search, axisName, sectionName, begin, isLatest]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- Inicia a leitura assíncrona da API para o escopo atual; os setters ocorrem na continuação da requisição.
    void fetchStats();
  }, [fetchStats]);

  return { stats, loading, error, refetch: fetchStats };
}
