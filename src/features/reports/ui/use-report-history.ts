"use client";

import { useCallback, useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { describeError, notify } from "@/infrastructure/notifications/notify";
import { listRespondentReports } from "@/features/reports/ui/respondent-client";
import type { RespondentReportHistoryRow } from "@/features/reports/ui/respondent-presentation";
import type { HistoryFilterState } from "@/features/reports/components/respondent/respondent-reports-filters";
import { useLatestRequestGuard } from "@/shared/hooks/use-latest-request-guard";
import {
  parseRespondentReportUrl,
  respondentReportHistoryPath,
} from "@/features/reports/respondent-report-paths";

const HISTORY_PAGE_SIZE = 25;

function sameFilters(left: HistoryFilterState, right: HistoryFilterState): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

/** Histórico paginado do respondente com URL como fonte restaurável de navegação. */
export function useReportHistory() {
  const router = useRouter();
  const pathname = usePathname() ?? "/respondente/relatorios";
  const searchParams = useSearchParams();
  const initial = parseRespondentReportUrl(searchParams);
  const [history, setHistory] = useState<RespondentReportHistoryRow[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [filters, setFiltersState] = useState<HistoryFilterState>(initial.filters);
  const [offset, setOffset] = useState(initial.offset);
  const [total, setTotal] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [availableYears, setAvailableYears] = useState<number[]>([]);
  const [error, setError] = useState<string | null>(null);
  const { begin, isLatest } = useLatestRequestGuard();

  const navigate = useCallback(
    (nextFilters: HistoryFilterState, nextOffset: number) => {
      setFiltersState(nextFilters);
      setOffset(nextOffset);
      const href = respondentReportHistoryPath(nextFilters, nextOffset);
      const current = searchParams.size > 0 ? `${pathname}?${searchParams.toString()}` : pathname;
      if (href !== current) router.replace(href, { scroll: false });
    },
    [pathname, router, searchParams],
  );

  useEffect(() => {
    const next = parseRespondentReportUrl(searchParams);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- Restaura a consulta ao usar voltar/avançar.
    setFiltersState((current) => (sameFilters(current, next.filters) ? current : next.filters));
    setOffset((current) => (current === next.offset ? current : next.offset));
  }, [searchParams]);

  const loadHistory = useCallback(async () => {
    const requestId = begin();
    setLoadingHistory(true);
    setError(null);
    try {
      const page = await listRespondentReports({
        search: filters.search,
        status:
          filters.status === "completed"
            ? "current"
            : filters.status === "outdated"
              ? "historical"
              : undefined,
        from: filters.from,
        to: filters.to,
        referenceYear: filters.yearPreset ?? undefined,
        kind: filters.kind || undefined,
        limit: HISTORY_PAGE_SIZE,
        offset,
      });
      if (!isLatest(requestId)) return;
      setHistory(page.items);
      setTotal(page.total);
      setHasMore(page.hasMore);
      setAvailableYears(page.availableYears);
    } catch (caught) {
      if (!isLatest(requestId)) return;
      const message = describeError(caught, "Falha ao carregar histórico.");
      setError(message);
      notify.error(message);
    } finally {
      if (isLatest(requestId)) setLoadingHistory(false);
    }
  }, [filters.from, filters.kind, filters.search, filters.status, filters.to, filters.yearPreset, offset, begin, isLatest]);

  const refresh = useCallback(async () => {
    await loadHistory();
  }, [loadHistory]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- Leitura assíncrona para o filtro e página atuais.
    void refresh();
  }, [refresh]);

  const setFilters = useCallback(
    (next: HistoryFilterState) => navigate(next, 0),
    [navigate],
  );
  const previousPage = useCallback(
    () => navigate(filters, Math.max(0, offset - HISTORY_PAGE_SIZE)),
    [filters, navigate, offset],
  );
  const nextPage = useCallback(
    () => navigate(filters, offset + HISTORY_PAGE_SIZE),
    [filters, navigate, offset],
  );

  return {
    history,
    loading: loadingHistory,
    filters,
    setFilters,
    filteredHistory: history,
    reportHistoryYears: availableYears,
    total,
    offset,
    pageSize: HISTORY_PAGE_SIZE,
    hasMore,
    error,
    previousPage,
    nextPage,
    refresh,
  };
}
