"use client";

import { useCallback, useEffect, useMemo, useReducer } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { notify } from "@/infrastructure/notifications/notify";
import {
  downloadPdfBlob,
  fetchCatalogReportPdf,
  generateAndDownloadOfficialReport,
  type ReportHistoryOption,
} from "@/features/reports/ui/client";
import { reportDownloadFilename } from "./report-shell-display";
import {
  createInitialReportsState,
  reportOffsetFromSearchParams,
  reportsHref,
  reportsReducer,
  type ReportsPatch,
} from "./reports-controller-model";
import { useReportDataLoaders } from "./use-report-data-loaders";

export function useReportsController({
  initialOrganizationId,
  initialCycleId,
  initialHistoryOffset,
}: {
  initialOrganizationId: string | null;
  initialCycleId: string | null;
  initialHistoryOffset: number;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [state, dispatch] = useReducer(
    reportsReducer,
    { initialOrganizationId, initialCycleId, initialHistoryOffset },
    createInitialReportsState,
  );
  const patch: ReportsPatch = useCallback((values) => {
    dispatch({ type: "patch", patch: values });
  }, []);
  const { loadCycles, loadOrganizations, loadHistory } = useReportDataLoaders({
    initialOrganizationId,
    initialCycleId,
    patch,
    router,
  });

  const selectedCycle = useMemo(
    () => state.cycles.find((cycle) => cycle.cycleId === state.cycleId) ?? null,
    [state.cycleId, state.cycles],
  );
  const isReissue =
    selectedCycle?.reportStatus === "available" &&
    (selectedCycle.emissionCount ?? 0) > 0;
  const missingReissueReason = isReissue && state.reissueReason.trim().length < 3;
  const canGenerate = Boolean(
    state.cycleId &&
    selectedCycle &&
    selectedCycle.cycleState === "completed" &&
    selectedCycle.referenceStartYear != null &&
    selectedCycle.referenceEndYear != null &&
    selectedCycle.reportStatus !== "emitting" &&
    selectedCycle.reportStatus !== "not_ready" &&
    selectedCycle.reportStatus !== "outdated" &&
    !missingReissueReason,
  );

  useEffect(() => {
    void loadOrganizations();
  }, [loadOrganizations]);

  useEffect(() => {
    void loadHistory(state.organizationId, state.cycleId, state.historyOffset);
  }, [loadHistory, state.cycleId, state.historyOffset, state.organizationId]);

  useEffect(() => {
    const organizationId = searchParams.get("organizationId") ?? "";
    const cycleId = searchParams.get("cycleId") ?? "";
    const historyOffset = reportOffsetFromSearchParams(searchParams);

    // URL é a fonte de verdade. Não depende do state local (evita corrida com router.push).
    patch({ organizationId, cycleId, historyOffset });

    let cancelled = false;
    void loadCycles(organizationId, cycleId).then((resolvedCycleId) => {
      // null = requisição obsoleta; não mexer na URL.
      if (cancelled || resolvedCycleId === null) return;
      if (resolvedCycleId === cycleId) return;
      // Só reescreve quando o ciclo pedido realmente não existe na API.
      router.replace(reportsHref(organizationId, resolvedCycleId, historyOffset), {
        scroll: false,
      });
    });

    return () => {
      cancelled = true;
    };
  }, [loadCycles, patch, router, searchParams]);

  useEffect(() => {
    patch({ reissueReason: "" });
  }, [patch, state.cycleId]);

  const selectOrganization = useCallback((organizationId: string) => {
    patch({
      organizationId,
      historyOffset: 0,
      cycles: [],
      cycleId: "",
      cycleSearch: "",
      cycleOffset: 0,
      cycleTotal: 0,
      cycleHasMore: false,
    });
    // O efeito de searchParams recarrega os ciclos a partir da URL.
    router.push(reportsHref(organizationId, "", 0), { scroll: false });
  }, [patch, router]);

  const searchCycles = useCallback(() => {
    patch({ historyOffset: 0, cycleId: "" });
    router.push(reportsHref(state.organizationId, "", 0), { scroll: false });
    void loadCycles(state.organizationId, "", 0, state.cycleSearch);
  }, [loadCycles, patch, router, state.cycleSearch, state.organizationId]);

  const selectCycle = useCallback((cycleId: string) => {
    patch({ historyOffset: 0, cycleId });
    router.push(reportsHref(state.organizationId, cycleId, 0), { scroll: false });
  }, [patch, router, state.organizationId]);

  const changeCyclePage = useCallback((offset: number) => {
    patch({ historyOffset: 0, cycleId: "" });
    router.push(reportsHref(state.organizationId, "", 0), { scroll: false });
    void loadCycles(state.organizationId, "", offset, state.cycleSearch);
  }, [loadCycles, patch, router, state.cycleSearch, state.organizationId]);

  const changeHistoryPage = useCallback((offset: number) => {
    patch({ historyOffset: offset });
    router.push(reportsHref(state.organizationId, state.cycleId, offset), { scroll: false });
  }, [patch, router, state.cycleId, state.organizationId]);

  const saveReferencePeriod = useCallback((reference: {
    referenceStartYear: number;
    referenceEndYear: number;
  }) => {
    if (!selectedCycle) return;
    patch({
      cycles: state.cycles.map((cycle) => cycle.cycleId === selectedCycle.cycleId
        ? { ...cycle, ...reference }
        : cycle),
    });
  }, [patch, selectedCycle, state.cycles]);

  const generate = useCallback(async () => {
    if (!selectedCycle) {
      notify.warning("Selecione um diagnóstico com Resultado FAMI disponível.");
      return;
    }
    if (selectedCycle.cycleState !== "completed") {
      notify.warning("Encerre a avaliação do diagnóstico antes de emitir o relatório oficial.");
      return;
    }
    if (selectedCycle.referenceStartYear == null || selectedCycle.referenceEndYear == null) {
      notify.warning("Defina a referência institucional antes de emitir o relatório oficial.");
      return;
    }
    if (selectedCycle.reportStatus === "emitting") {
      notify.warning("A emissão oficial já está em andamento.");
      return;
    }
    if (selectedCycle.reportStatus === "not_ready" || selectedCycle.reportStatus === "outdated") {
      notify.warning("Este diagnóstico ainda não está pronto para uma nova emissão oficial.");
      return;
    }
    if (isReissue && state.reissueReason.trim().length < 3) {
      notify.warning("Informe o motivo da reemissão para preservar a auditoria.");
      return;
    }

    patch({ generating: true });
    try {
      await generateAndDownloadOfficialReport({
        cycleId: selectedCycle.cycleId,
        processingVersion: selectedCycle.latestProcessingVersion,
        reissueReason: isReissue ? state.reissueReason.trim() : undefined,
      });
      patch({ historyOffset: 0 });
      router.replace(reportsHref(state.organizationId, selectedCycle.cycleId, 0), {
        scroll: false,
      });
      await Promise.all([
        loadCycles(
          state.organizationId,
          selectedCycle.cycleId,
          state.cycleOffset,
          state.cycleSearch,
        ),
        loadHistory(state.organizationId, selectedCycle.cycleId, 0),
      ]);
    } catch {
      // O cliente de relatórios emite a notificação detalhada.
    } finally {
      patch({ generating: false });
    }
  }, [
    isReissue,
    loadCycles,
    loadHistory,
    patch,
    router,
    selectedCycle,
    state.cycleOffset,
    state.cycleSearch,
    state.organizationId,
    state.reissueReason,
  ]);

  const download = useCallback(async (report: ReportHistoryOption) => {
    const notificationId = notify.loading("Preparando PDF…");
    try {
      downloadPdfBlob(
        await fetchCatalogReportPdf(report.downloadPath),
        reportDownloadFilename(report),
      );
      notify.success("Download iniciado.", { id: notificationId });
    } catch (error) {
      notify.error(error instanceof Error ? error.message : "Falha ao baixar relatório.", {
        id: notificationId,
      });
    }
  }, []);

  return {
    state,
    patch,
    selectedCycle,
    isReissue,
    canGenerate,
    loadOrganizations,
    loadCycles,
    loadHistory,
    selectOrganization,
    searchCycles,
    selectCycle,
    changeCyclePage,
    changeHistoryPage,
    saveReferencePeriod,
    generate,
    download,
  };
}

export type ReportsController = ReturnType<typeof useReportsController>;
