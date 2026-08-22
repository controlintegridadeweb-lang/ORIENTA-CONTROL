"use client";

import { useCallback, useEffect, useMemo, useRef } from "react";
import { usePatchState } from "@/shared/hooks/use-patch-state";
import {
  loadFamiCycles,
  loadFamiSnapshot,
  type FamiCycleOption,
  type FamiSnapshotResponse,
} from "@/features/fami/client";
import { loadRecommendationFilters } from "@/features/improvement-management";
import type { RecommendationFilterOptions } from "@/features/improvement-management";
import { getRespondentEvidenceStats } from "@/features/evidences";
import type { RespondentStatsResult } from "@/features/evidences";
import { getRespondentOverviewItems } from "@/features/improvement-management";
import {
  toRespondentItem,
  type RespondentRecommendationItem,
} from "@/features/improvement-management";
import { useLatestRequestGuard } from "@/shared/hooks/use-latest-request-guard";

type RespondentFamiState = {
  filters: RecommendationFilterOptions | null;
  /** Identificador do diagnóstico com processamento FAMI concluído selecionado. */
  scopeId: string;
  cycles: FamiCycleOption[];
  cycleScoped: FamiSnapshotResponse | null;
  /** Estatísticas no mesmo escopo do diagnóstico exibido. */
  evidenceStats: RespondentStatsResult | null;
  /** Recomendações no mesmo escopo do diagnóstico exibido. */
  recommendations: RespondentRecommendationItem[];
  loading: boolean;
  refreshing: boolean;
  error: string | null;
};

/**
 * O resultado FAMI é sempre apresentado por processamento concluído de um diagnóstico. Não existe
 * média entre formulários ou períodos, porque ela não representa uma pontuação
 * oficial comparável.
 */
export function useRespondentFami(
  initialOrganizationId: string | null,
  initialCycleId?: string | null,
  initialSnapshotYear?: number | null,
) {
  const [state, patchState] = usePatchState({
    filters: null as RecommendationFilterOptions | null,
    scopeId: initialCycleId ?? "",
    organizationId: initialOrganizationId ?? "",
    cycles: [] as FamiCycleOption[],
    cycleScoped: null as FamiSnapshotResponse | null,
    cycleEvidenceStats: null as RespondentStatsResult | null,
    allRecommendations: [] as RespondentRecommendationItem[],
    bootLoading: true,
    cyclesLoading: true,
    snapshotLoading: false,
    error: null as string | null,
    snapshotYearFilter: initialSnapshotYear ?? null as number | null,
  });
  const {
    filters,
    scopeId,
    organizationId,
    cycles,
    cycleScoped,
    cycleEvidenceStats,
    allRecommendations,
    bootLoading,
    cyclesLoading,
    snapshotLoading,
    error,
    snapshotYearFilter,
  } = state;
  const setScopeId = useCallback((value: string) => patchState({ scopeId: value }), [patchState]);
  const setSnapshotYearFilter = useCallback((value: number | null) => patchState({ snapshotYearFilter: value }), [patchState]);
  const previousScopeKeyRef = useRef(
    `${initialOrganizationId ?? ""}|${initialCycleId ?? ""}`,
  );
  const {
    begin: beginSnapshotRequest,
    isLatest: isLatestSnapshotRequest,
    invalidate: invalidateSnapshotRequest,
  } = useLatestRequestGuard();
  const {
    begin: beginOverviewRequest,
    isLatest: isLatestOverviewRequest,
  } = useLatestRequestGuard();

  const selectedCycle = useMemo(
    () => cycles.find((cycle) => cycle.id === scopeId) ?? null,
    [cycles, scopeId],
  );
  const activeRecommendations = useMemo(
    () =>
      selectedCycle
        ? allRecommendations.filter((recommendation) => recommendation.cycleId === selectedCycle.id)
        : [],
    [allRecommendations, selectedCycle],
  );

  useEffect(() => {
    let cancelled = false;
    async function boot() {
      patchState({ bootLoading: true, error: null });
      try {
        const [filtersResult, overviewItems] = await Promise.all([
          loadRecommendationFilters(),
          getRespondentOverviewItems().catch(() => null),
        ]);
        if (cancelled) return;
        patchState({
          filters: filtersResult,
          allRecommendations: overviewItems ? overviewItems.map(toRespondentItem) : [],
        });
        if (!organizationId && filtersResult.organizations.length === 1) {
          patchState({ organizationId: filtersResult.organizations[0]!.id });
        }
      } catch (caught) {
        if (!cancelled) {
          patchState({ error: caught instanceof Error ? caught.message : "Falha ao carregar filtros." });
        }
      } finally {
        if (!cancelled) patchState({ bootLoading: false });
      }
    }
    void boot();
    return () => {
      cancelled = true;
    };
  }, [organizationId, patchState]);

  useEffect(() => {
    patchState({ snapshotYearFilter: initialSnapshotYear ?? null });
  }, [initialSnapshotYear, patchState]);

  useEffect(() => {
    let cancelled = false;
    if (!organizationId) {
      patchState({ cycles: [], scopeId: "", cyclesLoading: false });
      return () => {
        cancelled = true;
      };
    }
    patchState({ cyclesLoading: true });
    loadFamiCycles({ organizationId, authRole: "respondent" })
      .then((items) => {
        if (cancelled) return;
        patchState((current) => ({
          cycles: items,
          scopeId:
            initialCycleId && items.some((cycle) => cycle.id === initialCycleId)
              ? initialCycleId
              : current.scopeId && items.some((cycle) => cycle.id === current.scopeId)
                ? current.scopeId
                : items[0]?.id ?? "",
        }));
      })
      .catch((caught) => {
        if (!cancelled) {
          patchState({ error: caught instanceof Error ? caught.message : "Falha ao carregar diagnósticos FAMI." });
        }
      })
      .finally(() => {
        if (!cancelled) patchState({ cyclesLoading: false });
      });
    return () => {
      cancelled = true;
    };
  }, [initialCycleId, organizationId, patchState]);

  useEffect(() => {
    const scopeKey = `${organizationId}|${scopeId}`;
    if (previousScopeKeyRef.current === scopeKey) return;
    previousScopeKeyRef.current = scopeKey;
    patchState({
      snapshotYearFilter: null,
      cycleScoped: null,
      cycleEvidenceStats: null,
    });
  }, [scopeId, organizationId, patchState]);

  const fetchSnapshot = useCallback(async () => {
    if (!organizationId || !selectedCycle) {
      invalidateSnapshotRequest();
      patchState({
        cycleScoped: null,
        cycleEvidenceStats: null,
        snapshotLoading: false,
      });
      return;
    }
    const requestId = beginSnapshotRequest();
    patchState({ snapshotLoading: true, error: null });
    try {
      const [snapshot, stats] = await Promise.all([
        loadFamiSnapshot({
          cycleId: selectedCycle.id,
          authRole: "respondent",
          year: snapshotYearFilter ?? undefined,
          evolutionMode: "years",
        }),
        getRespondentEvidenceStats({ cycleId: selectedCycle.id }).catch(() => null),
      ]);
      if (!isLatestSnapshotRequest(requestId)) return;
      patchState({
        cycleScoped: snapshot,
        cycleEvidenceStats: stats,
        error: null,
      });
    } catch (caught) {
      if (isLatestSnapshotRequest(requestId)) {
        patchState({
          error: caught instanceof Error ? caught.message : "Falha ao carregar FAMI.",
          cycleScoped: null,
          cycleEvidenceStats: null,
        });
      }
    } finally {
      if (isLatestSnapshotRequest(requestId)) patchState({ snapshotLoading: false });
    }
  }, [
    beginSnapshotRequest,
    invalidateSnapshotRequest,
    isLatestSnapshotRequest,
    organizationId,
    selectedCycle,
    snapshotYearFilter,
    patchState,
  ]);

  useEffect(() => {
    void fetchSnapshot();
  }, [fetchSnapshot]);

  const refresh = useCallback(async () => {
    const requestId = beginOverviewRequest();
    const overview = getRespondentOverviewItems({ force: true })
      .then((items) => {
        if (isLatestOverviewRequest(requestId)) {
          patchState({ allRecommendations: items.map(toRespondentItem) });
        }
      })
      .catch(() => undefined);
    await Promise.all([fetchSnapshot(), overview]);
  }, [beginOverviewRequest, fetchSnapshot, isLatestOverviewRequest, patchState]);

  const axisStats = useMemo(() => {
    const map = new Map<
      string,
      {
        recommendationsOpen: number;
        recommendationsTotal: number;
        awaitingAction: number;
        evidencesPending: number;
      }
    >();
    for (const recommendation of activeRecommendations) {
      const key = recommendation.axisName || "Sem eixo";
      const current = map.get(key) ?? {
        recommendationsOpen: 0,
        recommendationsTotal: 0,
        awaitingAction: 0,
        evidencesPending: 0,
      };
      current.recommendationsTotal += 1;
      if (recommendation.status !== "completed" && recommendation.status !== "dismissed") {
        current.recommendationsOpen += 1;
      }
      if (recommendation.needsAction) current.awaitingAction += 1;
      map.set(key, current);
    }
    return map;
  }, [activeRecommendations]);

  return {
    state: {
      filters,
      scopeId,
      cycles,
      cycleScoped,
      evidenceStats: cycleEvidenceStats,
      recommendations: activeRecommendations,
      loading: bootLoading || cyclesLoading,
      refreshing: snapshotLoading,
      error,
    } satisfies RespondentFamiState,
    organizationId,
    setScopeId,
    setSnapshotYearFilter,
    snapshotYearFilter,
    refresh,
    axisStats,
    activeSnapshot: cycleScoped,
    selectedCycle,
  };
}
