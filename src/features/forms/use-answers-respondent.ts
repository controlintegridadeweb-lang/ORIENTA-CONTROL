"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  getRespondentDetail,
  listAnswerRespondents,
} from "@/features/forms/answers-client";
import {
  RESPONDENT_LIST_DEFAULT_LIMIT,
  type AnswersListFilters,
  type RespondentDetail,
  type RespondentListCursor,
  type RespondentListPage,
  type RespondentRow,
} from "@/features/forms/answers-types";
import { describeError, notify } from "@/infrastructure/notifications/notify";

type FetchRespondentsInput = {
  reset: boolean;
  cursor: RespondentListCursor | null;
};

/**
 * Gerencia a listagem paginada de respondentes, cursor e detalhe do
 * respondente selecionado. A leitura ocorre somente quando a aba que a usa
 * está visível, evitando requisições duplicadas entre hook e componente-pai.
 */
export function useAnswersRespondent({
  formId,
  filters,
  enabled,
}: {
  formId: string;
  filters: AnswersListFilters;
  enabled: boolean;
}) {
  const [respondents, setRespondents] = useState<RespondentRow[] | null>(null);
  const [respondentsError, setRespondentsError] = useState<string | null>(null);
  const [cursor, setCursor] = useState<RespondentListCursor | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const requestIdRef = useRef(0);

  const [selectedCycleId, setSelectedCycleId] = useState<string | null>(null);
  const [detail, setDetail] = useState<RespondentDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const detailRequestIdRef = useRef(0);

  const fetchRespondents = useCallback(
    async ({ reset, cursor: currentCursor }: FetchRespondentsInput): Promise<RespondentListPage | null> => {
      const requestId = ++requestIdRef.current;
      if (reset) {
        setRespondents(null);
        setCursor(null);
      }
      setLoadingMore(true);
      setRespondentsError(null);

      try {
        const page = await listAnswerRespondents(formId, {
          ...filters,
          limit: RESPONDENT_LIST_DEFAULT_LIMIT,
          cursor: reset ? undefined : (currentCursor ?? undefined),
        });
        if (requestId !== requestIdRef.current) return null;

        setRespondents((previous) =>
          reset ? page.rows : [...(previous ?? []), ...page.rows],
        );
        setCursor(page.nextCursor ?? null);
        return page;
      } catch (error) {
        if (requestId === requestIdRef.current) {
          const message = describeError(error, "Falha ao carregar respondentes.");
          setRespondentsError(message);
          notify.error(message);
        }
        return null;
      } finally {
        if (requestId === requestIdRef.current) setLoadingMore(false);
      }
    },
    [filters, formId],
  );

  const loadRespondents = useCallback(
    (reset = false) => fetchRespondents({ reset, cursor: reset ? null : cursor }),
    [cursor, fetchRespondents],
  );

  useEffect(() => {
    if (!enabled) {
      requestIdRef.current += 1;
      return;
    }

    // eslint-disable-next-line react-hooks/set-state-in-effect -- A consulta é iniciada no efeito; o carregamento atualiza o estado do recurso assíncrono.
    void fetchRespondents({ reset: true, cursor: null });
  }, [enabled, fetchRespondents]);

  const loadDetail = useCallback(async (cycleId: string) => {
    const requestId = ++detailRequestIdRef.current;
    setSelectedCycleId(cycleId);
    setDetail(null);
    setDetailLoading(true);
    setDetailError(null);
    try {
      const nextDetail = await getRespondentDetail(cycleId);
      if (requestId === detailRequestIdRef.current) setDetail(nextDetail);
    } catch (error) {
      if (requestId === detailRequestIdRef.current) {
        const message = describeError(error, "Falha ao carregar detalhes.");
        setDetailError(message);
        notify.error(message);
      }
    } finally {
      if (requestId === detailRequestIdRef.current) setDetailLoading(false);
    }
  }, []);

  return {
    respondents,
    respondentsError,
    cursor,
    loadingMore,
    selectedCycleId,
    setSelectedCycleId,
    detail,
    detailLoading,
    detailError,
    loadRespondents,
    loadDetail,
  };
}
