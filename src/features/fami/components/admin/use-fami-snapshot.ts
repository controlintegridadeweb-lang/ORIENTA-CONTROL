"use client";

import { formatFamiPolicyLabel, formatProcessingLabel } from "@/features/fami/presentation-labels";
import { useCallback, useEffect, useMemo, useRef } from "react";
import { usePatchState } from "@/shared/hooks/use-patch-state";
import type { RecommendationFilterOptions } from "@/features/improvement-management";
import { loadRecommendationFilters } from "@/features/improvement-management";
import {
  loadFamiCycles,
  loadFamiSnapshot,
  reconcileFamiRequest,
  type FamiCycleOption,
  type FamiSnapshotResponse,
} from "@/features/fami/client";
import { describeError, notify } from "@/infrastructure/notifications/notify";
import { useConfirm } from "@/shared/ui/components/confirm-dialog";
import { useLatestRequestGuard } from "@/shared/hooks/use-latest-request-guard";
import type { AdminFamiTab } from "@/shared/navigation/fami-paths";

export type UseFamiSnapshotParams = {
  mode: "admin" | "respondent";
  defaultOrganizationId: string | null;
  /** Preferência para selecionar um diagnóstico do formulário indicado. */
  defaultFormId?: string | null;
  /** Diagnóstico preselecionado ao chegar do detalhe do diagnóstico. */
  defaultCycleId?: string | null;
  defaultSnapshotYear?: number | null;
  defaultTab?: AdminFamiTab;
};

/**
 * O Resultado FAMI é sempre consultado por processamento concluído de um diagnóstico. Não há modo
 * agregado entre organizações, formulários ou períodos distintos.
 */
export function useFamiSnapshot({
  mode,
  defaultOrganizationId,
  defaultFormId,
  defaultCycleId,
  defaultSnapshotYear,
  defaultTab = "resumo",
}: UseFamiSnapshotParams) {
  const [state, patchState] = usePatchState({
    filters: null as RecommendationFilterOptions | null,
    snapshotYearFilter: defaultSnapshotYear ?? null as number | null,
    organizationId: defaultOrganizationId ?? "",
    cycleId: defaultCycleId ?? "",
    cycles: [] as FamiCycleOption[],
    tab: defaultTab as AdminFamiTab,
    data: null as FamiSnapshotResponse | null,
    loading: false,
    filtersError: null as string | null,
    cyclesError: null as string | null,
    snapshotError: null as string | null,
    reconciliationLoading: false,
  });
  const {
    filters,
    snapshotYearFilter,
    organizationId,
    cycleId,
    cycles,
    tab,
    data,
    loading,
    filtersError,
    cyclesError,
    snapshotError,
    reconciliationLoading,
  } = state;
  const setOrganizationId = useCallback((value: string) => patchState({ organizationId: value }), [patchState]);
  const setCycleId = useCallback((value: string) => patchState({ cycleId: value }), [patchState]);
  const setTab = useCallback((value: AdminFamiTab) => patchState({ tab: value }), [patchState]);
  const setSnapshotYearFilter = useCallback((value: number | null) => patchState({ snapshotYearFilter: value }), [patchState]);
  const previousScopeKeyRef = useRef(
    `${defaultOrganizationId ?? ""}|${defaultCycleId ?? ""}`,
  );
  const confirm = useConfirm();
  const {
    begin: beginSnapshotRequest,
    isLatest: isLatestSnapshotRequest,
    invalidate: invalidateSnapshotRequest,
  } = useLatestRequestGuard();

  useEffect(() => {
    patchState({ organizationId: defaultOrganizationId ?? "" });
  }, [defaultOrganizationId, patchState]);

  useEffect(() => {
    patchState({
      snapshotYearFilter: defaultSnapshotYear ?? null,
      tab: defaultTab,
    });
  }, [defaultSnapshotYear, defaultTab, patchState]);

  const fetchFilters = useCallback(async () => {
    patchState({ filtersError: null });
    try {
      patchState({ filters: await loadRecommendationFilters() });
    } catch (error: unknown) {
      patchState({ filtersError: describeError(error, "Não foi possível carregar as organizações disponíveis.") });
    }
  }, [patchState]);

  useEffect(() => {
    void fetchFilters();
  }, [fetchFilters]);

  const fetchCycles = useCallback(async () => {
    if (!organizationId) {
      patchState({ cycles: [], cycleId: "", cyclesError: null });
      return;
    }
    patchState({ cyclesError: null });
    try {
      const items = await loadFamiCycles({ organizationId, authRole: mode });
      patchState((current) => {
        const byUrl = defaultCycleId
          ? items.find((cycle) => cycle.id === defaultCycleId)
          : null;
        const currentCycleId =
          current.cycleId && items.some((cycle) => cycle.id === current.cycleId)
            ? current.cycleId
            : null;
        const byForm = defaultFormId
          ? items.find((cycle) => cycle.formId === defaultFormId)
          : null;
        return {
          cycles: items,
          cycleId: byUrl?.id ?? currentCycleId ?? byForm?.id ?? items[0]?.id ?? "",
        };
      });
    } catch (error: unknown) {
      patchState({
        cycles: [],
        cycleId: "",
        cyclesError: describeError(
          error,
          "Não foi possível carregar os diagnósticos com Resultado FAMI.",
        ),
      });
    }
  }, [defaultCycleId, defaultFormId, mode, organizationId, patchState]);

  useEffect(() => {
    void fetchCycles();
  }, [fetchCycles]);

  const effectiveCycle = useMemo(
    () => cycles.find((cycle) => cycle.id === cycleId) ?? null,
    [cycles, cycleId],
  );
  const effectiveFormId = effectiveCycle?.formId ?? "";

  useEffect(() => {
    const scopeKey = `${organizationId}|${cycleId}`;
    if (previousScopeKeyRef.current === scopeKey) return;
    previousScopeKeyRef.current = scopeKey;
    patchState({ snapshotYearFilter: null, data: null });
    invalidateSnapshotRequest();
  }, [cycleId, invalidateSnapshotRequest, organizationId, patchState]);

  const fetchSnapshot = useCallback(async () => {
    if (!effectiveCycle) {
      invalidateSnapshotRequest();
      patchState({ data: null, snapshotError: null, loading: false });
      return;
    }

    const requestId = beginSnapshotRequest();
    patchState({ loading: true, snapshotError: null });
    try {
      const response = await loadFamiSnapshot({
        cycleId: effectiveCycle.id,
        authRole: mode,
        year: snapshotYearFilter ?? undefined,
        evolutionMode: "years",
      });
      if (isLatestSnapshotRequest(requestId)) patchState({ data: response });
    } catch (error: unknown) {
      if (isLatestSnapshotRequest(requestId)) {
        patchState({
          snapshotError: describeError(
            error,
            "Não foi possível carregar o Resultado FAMI.",
          ),
          data: null,
        });
      }
    } finally {
      if (isLatestSnapshotRequest(requestId)) patchState({ loading: false });
    }
  }, [
    beginSnapshotRequest,
    effectiveCycle,
    invalidateSnapshotRequest,
    isLatestSnapshotRequest,
    mode,
    snapshotYearFilter,
    patchState,
  ]);

  useEffect(() => {
    void fetchSnapshot();
  }, [fetchSnapshot]);

  const handleReconciliation = useCallback(async () => {
    if (!effectiveCycle) {
      notify.error("Selecione um diagnóstico específico para conferir o Resultado FAMI.");
      return;
    }
    if (
      !(await confirm({
        title: "Conferir Resultado FAMI?",
        description:
          "A conferência compara a pontuação oficial com os snapshots e a política congelada, sem alterar resultados nem recomendações.",
        confirmLabel: "Conferir",
      }))
    )
      return;

    patchState({ reconciliationLoading: true });
    try {
      const result = await reconcileFamiRequest({ cycleId: effectiveCycle.id, authRole: "admin" });
      notify.success(
        result.matches
          ? `Conferência concluída: ${formatProcessingLabel(result.processingVersion)} (${formatFamiPolicyLabel(result.policyVersion)}) confere com o resultado oficial.`
          : `Conferência concluída: há divergência no ${formatProcessingLabel(result.processingVersion)} (${formatFamiPolicyLabel(result.policyVersion)}); revise o diagnóstico.`,
      );
      await fetchSnapshot();
    } catch (error: unknown) {
      notify.error(describeError(error, "Falha ao conferir FAMI."));
    } finally {
      patchState({ reconciliationLoading: false });
    }
  }, [confirm, effectiveCycle, fetchSnapshot, patchState]);

  return {
    filters,
    filtersError,
    cyclesError,
    snapshotError,
    cycles,
    organizationId,
    setOrganizationId,
    cycleId,
    setCycleId,
    tab,
    setTab,
    data,
    loading,
    reconciliationLoading,
    snapshotYearFilter,
    setSnapshotYearFilter,
    effectiveFormId,
    effectiveCycle,
    fetchSnapshot,
    fetchFilters,
    fetchCycles,
    handleReconciliation,
  };
}
