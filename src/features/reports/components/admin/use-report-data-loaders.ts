"use client";

import { useCallback } from "react";
import { useLatestRequestGuard } from "@/shared/hooks/use-latest-request-guard";
import {
  loadReportHistory,
  loadReportOptions,
} from "@/features/reports/ui/client";
import {
  REPORT_CYCLE_PAGE_SIZE,
  REPORT_HISTORY_PAGE_SIZE,
  reportsHref,
  type ReportsPatch,
} from "./reports-controller-model";

type ReportsRouter = {
  replace(href: string, options?: { scroll?: boolean }): void;
};

export function useReportDataLoaders({
  initialOrganizationId,
  initialCycleId,
  patch,
  router,
}: {
  initialOrganizationId: string | null;
  initialCycleId: string | null;
  patch: ReportsPatch;
  router: ReportsRouter;
}) {
  const {
    begin: beginOrganizationsRequest,
    isLatest: isLatestOrganizationsRequest,
  } = useLatestRequestGuard();
  const {
    begin: beginCyclesRequest,
    isLatest: isLatestCyclesRequest,
    invalidate: invalidateCyclesRequest,
  } = useLatestRequestGuard();
  const {
    begin: beginHistoryRequest,
    isLatest: isLatestHistoryRequest,
    invalidate: invalidateHistoryRequest,
  } = useLatestRequestGuard();

  const loadCycles = useCallback(async (
    organizationId: string,
    preferredCycleId = "",
    offset = 0,
    search = "",
  ): Promise<string> => {
    if (!organizationId) {
      invalidateCyclesRequest();
      patch({
        cycles: [],
        cycleId: "",
        cycleTotal: 0,
        cycleHasMore: false,
        loadingCycles: false,
      });
      return "";
    }

    const requestId = beginCyclesRequest();
    patch({ loadingCycles: true, cyclesError: null });
    try {
      const page = await loadReportOptions({
        organizationId,
        search,
        limit: REPORT_CYCLE_PAGE_SIZE,
        offset,
      });
      if (!isLatestCyclesRequest(requestId)) return "";

      let cycles = page.cycles;
      if (preferredCycleId && !cycles.some((cycle) => cycle.cycleId === preferredCycleId)) {
        const exact = await loadReportOptions({
          organizationId,
          cycleId: preferredCycleId,
          limit: 1,
          offset: 0,
        });
        if (!isLatestCyclesRequest(requestId)) return "";
        cycles = [
          ...exact.cycles,
          ...cycles.filter((cycle) => cycle.cycleId !== preferredCycleId),
        ];
      }

      const cycleId = cycles.some((cycle) => cycle.cycleId === preferredCycleId)
        ? preferredCycleId
        : "";
      patch({
        cycles,
        cycleId,
        cycleOffset: offset,
        cycleTotal: page.totalCycles,
        cycleHasMore: page.hasMoreCycles,
      });
      return cycleId;
    } catch (error) {
      if (isLatestCyclesRequest(requestId)) {
        patch({
          cyclesError: error instanceof Error
            ? error.message
            : "Não foi possível carregar os diagnósticos.",
        });
      }
      return "";
    } finally {
      if (isLatestCyclesRequest(requestId)) patch({ loadingCycles: false });
    }
  }, [beginCyclesRequest, invalidateCyclesRequest, isLatestCyclesRequest, patch]);

  const loadOrganizations = useCallback(async () => {
    const requestId = beginOrganizationsRequest();
    patch({ loadingScopes: true, scopeError: null });
    try {
      const { organizations } = await loadReportOptions({});
      if (!isLatestOrganizationsRequest(requestId)) return;
      patch({ organizations });
      const organizationId =
        initialOrganizationId && organizations.some((item) => item.id === initialOrganizationId)
          ? initialOrganizationId
          : organizations.length === 1
            ? organizations[0]!.id
            : "";
      if (!organizationId) return;

      patch({ organizationId });
      const cycleId = await loadCycles(organizationId, initialCycleId ?? "");
      if (!initialOrganizationId && organizations.length === 1) {
        router.replace(reportsHref(organizationId, cycleId, 0), { scroll: false });
      }
    } catch (error) {
      if (isLatestOrganizationsRequest(requestId)) {
        patch({
          scopeError: error instanceof Error
            ? error.message
            : "Não foi possível carregar as organizações.",
        });
      }
    } finally {
      if (isLatestOrganizationsRequest(requestId)) patch({ loadingScopes: false });
    }
  }, [
    beginOrganizationsRequest,
    initialCycleId,
    initialOrganizationId,
    isLatestOrganizationsRequest,
    loadCycles,
    patch,
    router,
  ]);

  const loadHistory = useCallback(async (
    organizationId: string,
    cycleId: string,
    offset: number,
  ) => {
    if (!organizationId) {
      invalidateHistoryRequest();
      patch({
        history: [],
        historyTotal: 0,
        historyHasMore: false,
        historyError: null,
        loadingHistory: false,
      });
      return;
    }

    const requestId = beginHistoryRequest();
    patch({ loadingHistory: true, historyError: null });
    try {
      const page = await loadReportHistory({
        organizationId,
        cycleId: cycleId || undefined,
        limit: REPORT_HISTORY_PAGE_SIZE,
        offset,
      });
      if (!isLatestHistoryRequest(requestId)) return;
      patch({
        history: page.items,
        historyTotal: page.total,
        historyHasMore: page.hasMore,
      });
    } catch (error) {
      if (isLatestHistoryRequest(requestId)) {
        patch({
          historyError: error instanceof Error ? error.message : "Falha ao carregar histórico.",
        });
      }
    } finally {
      if (isLatestHistoryRequest(requestId)) patch({ loadingHistory: false });
    }
  }, [beginHistoryRequest, invalidateHistoryRequest, isLatestHistoryRequest, patch]);

  return { loadCycles, loadOrganizations, loadHistory };
}
