"use client";

import { useCallback, useEffect, useState } from "react";
import type {
  EvidenceValidationEntry,
  EvidencesListResult,
} from "@/features/evidences/types";
import { listEvidences, type ListEvidencesFilters } from "@/features/evidences/client";
import { describeError } from "@/infrastructure/notifications/notify";
import { useLatestRequestGuard } from "@/shared/hooks/use-latest-request-guard";

type ListParams = ListEvidencesFilters & { offset: number };

export function useEvidencesList(params: ListParams) {
  const [result, setResult] = useState<EvidencesListResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { begin, isLatest } = useLatestRequestGuard();

  const fetchList = useCallback(async () => {
    const requestId = begin();
    setLoading(true);
    setError(null);
    try {
      const res = await listEvidences({
        cycleId: params.cycleId,
        questionId: params.questionId,
        formId: params.formId,
        organizationId: params.organizationId,
        status: params.status,
        search: params.search,
        from: params.from,
        to: params.to,
        limit: params.limit,
        offset: params.offset,
        ids: params.ids,
      });
      if (isLatest(requestId)) setResult(res);
    } catch (caught) {
      if (isLatest(requestId)) {
        setError(describeError(caught, "Falha ao carregar a lista de evidências."));
      }
    } finally {
      if (isLatest(requestId)) setLoading(false);
    }
  }, [
    params.cycleId,
    params.questionId,
    params.formId,
    params.organizationId,
    params.status,
    params.search,
    params.from,
    params.to,
    params.limit,
    params.offset,
    params.ids,
    begin,
    isLatest,
  ]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- Inicia a leitura assíncrona da API para o escopo atual; os setters ocorrem na continuação da requisição.
    void fetchList();
  }, [fetchList]);

  const updateAfterValidation = useCallback(
    (evidenceId: string, entry: EvidenceValidationEntry) => {
      setResult((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          items: prev.items.map((it) =>
            it.id === evidenceId
              ? {
                  ...it,
                  currentStatus: entry.status,
                  lastValidatedAt: entry.validatedAt,
                  lastJustification: entry.justification,
                  history: [entry, ...it.history],
                }
              : it,
          ),
        };
      });
    },
    [],
  );

  return { result, loading, error, refetch: fetchList, updateAfterValidation };
}
