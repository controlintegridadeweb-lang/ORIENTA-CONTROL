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

/** `null` = requisição obsoleta (não deve alterar URL nem sobrescrever seleção). */
export type LoadCyclesResult = string | null;

export function useReportDataLoaders({
  initialOrganizationId,
  initialCycleId,
  initialHistoryKind = "",
  patch,
  router,
}: {
  initialOrganizationId: string | null;
  initialCycleId: string | null;
  initialHistoryKind?: "" | "annual" | "bimonthly";
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
  ): Promise<LoadCyclesResult> => {
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
      if (!isLatestCyclesRequest(requestId)) return null;

      let cycles = page.cycles;
      if (preferredCycleId && !cycles.some((cycle) => cycle.cycleId === preferredCycleId)) {
        const exact = await loadReportOptions({
          organizationId,
          cycleId: preferredCycleId,
          limit: 1,
          offset: 0,
        });
        if (!isLatestCyclesRequest(requestId)) return null;
        cycles = [
          ...exact.cycles,
          ...cycles.filter((cycle) => cycle.cycleId !== preferredCycleId),
        ];
      }

      const foundPreferred = Boolean(
        preferredCycleId && cycles.some((cycle) => cycle.cycleId === preferredCycleId),
      );
      // Mantém o id da URL no state mesmo se a lista ainda não o trouxe —
      // evita o <select> voltar para "Selecione" no meio da escolha.
      const nextCycleId = preferredCycleId ? preferredCycleId : "";

      patch({
        cycles,
        cycleId: nextCycleId,
        cycleOffset: offset,
        cycleTotal: page.totalCycles,
        cycleHasMore: page.hasMoreCycles,
      });

      // Só sinaliza “não encontrado” quando houve preferência e ela não existe.
      if (preferredCycleId && !foundPreferred) return "";
      return nextCycleId;
    } catch (error) {
      if (isLatestCyclesRequest(requestId)) {
        patch({
          cyclesError: error instanceof Error
            ? error.message
            : "Não foi possível carregar os diagnósticos.",
        });
      }
      return null;
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

      // Ciclos são carregados pelo efeito de searchParams (URL = fonte de verdade).
      // Aqui só escolhemos organização automaticamente quando a URL ainda não tem uma.
      if (initialOrganizationId) {
        if (!organizations.some((item) => item.id === initialOrganizationId)) {
          patch({
            scopeError: "A organização indicada na URL não está disponível.",
          });
        }
        return;
      }

      if (organizations.length === 1) {
        router.replace(
          reportsHref(organizations[0]!.id, initialCycleId ?? "", 0, initialHistoryKind),
          { scroll: false },
        );
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
    initialHistoryKind,
    initialOrganizationId,
    isLatestOrganizationsRequest,
    patch,
    router,
  ]);

  const loadHistory = useCallback(async (
    organizationId: string,
    cycleId: string,
    offset: number,
    kind: "" | "annual" | "bimonthly" = "",
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
        kind: kind || undefined,
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
