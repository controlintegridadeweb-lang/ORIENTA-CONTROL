"use client";

import { useCallback, useEffect, useState } from "react";
import {
  listRespondentEvidences,
  type RespondentEvidenceFilters,
} from "@/features/evidences/respondent-client";
import type { RespondentEvidenceListResult } from "@/features/evidences/respondent-service";
import { useLatestRequestGuard } from "@/shared/hooks/use-latest-request-guard";

export function useRespondentEvidences(filters: RespondentEvidenceFilters) {
  const [result, setResult] = useState<RespondentEvidenceListResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { begin, isLatest } = useLatestRequestGuard();

  const {
    cycleId,
    formId,
    search,
    axisName,
    sectionName,
    status,
    pendingOnly,
    limit,
    offset,
  } = filters;

  const fetchList = useCallback(async () => {
    const requestId = begin();
    setLoading(true);
    setError(null);
    try {
      const r = await listRespondentEvidences({
        cycleId,
        formId,
        search,
        axisName,
        sectionName,
        status,
        pendingOnly,
        limit,
        offset,
      });
      if (isLatest(requestId)) setResult(r);
    } catch (e) {
      if (isLatest(requestId)) {
        setError(e instanceof Error ? e.message : "Falha ao carregar evidências.");
      }
    } finally {
      if (isLatest(requestId)) setLoading(false);
    }
  }, [
    cycleId,
    formId,
    search,
    axisName,
    sectionName,
    status,
    pendingOnly,
    limit,
    offset,
    begin,
    isLatest,
  ]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- Inicia a leitura assíncrona da API para o escopo atual; os setters ocorrem na continuação da requisição.
    void fetchList();
  }, [fetchList]);

  return { result, loading, error, refetch: fetchList };
}
