"use client";

import { useCallback, useRef } from "react";
import { describeError, notify } from "@/infrastructure/notifications/notify";
import {
  downloadPdfBlob,
  fetchCatalogReportPdf,
  openPdfBlob,
} from "@/features/reports/ui/client";
import { reportCatalogLabels } from "@/shared/labels/official-labels";
import { respondentFamiPath } from "@/shared/navigation/fami-paths";
import { formSurface } from "@/shared/layout/form-surface";
import type { RespondentReportHistoryRow } from "@/features/reports/ui/respondent-presentation";
import { RespondentReportsHero } from "./respondent-reports-hero";
import { RESPONDENT_PAGE_HERO_BLEED } from "@/shared/layout/respondent-page-layout";
import {
  INITIAL_HISTORY_FILTERS,
  RespondentReportsFilters,
} from "./respondent-reports-filters";
import { RespondentReportsHistoryList } from "./respondent-reports-history-list";
import { RespondentReportsEmptyState } from "./respondent-reports-empty-state";
import { PanelSection } from "@/shared/ui/components/panel-section";
import { layout } from "@/shared/layout/design-system";
import { useReportHistory } from "@/features/reports/ui/use-report-history";
import { AsyncErrorState } from "@/shared/ui/components/async-error-state";

function reportFilename(row: RespondentReportHistoryRow): string {
  const safeFormName = row.formName
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .toLowerCase();
  if (row.catalogKind === "bimonthly") {
    return `relatorio-bimestral-${row.referenceStartYear ?? "ano"}-b${row.bimester ?? "x"}-${row.id.slice(0, 8)}.pdf`;
  }
  return `relatorio-orienta-${safeFormName || "diagnostico"}-processamento-${row.processingVersion}-emissao-${row.emissionVersion}-${row.id.slice(0, 8)}.pdf`;
}

/** Consulta documentos já emitidos pela administração. Nenhuma ação desta tela emite ou reemite PDF. */
export function RespondentReportsShell() {
  const historyAnchorRef = useRef<HTMLDivElement>(null);

  const {
    history,
    loading,
    filters,
    setFilters,
    filteredHistory,
    reportHistoryYears,
    total,
    offset,
    pageSize,
    hasMore,
    error: historyError,
    previousPage,
    nextPage,
    refresh,
  } = useReportHistory();

  const scrollHistory = useCallback(() => {
    historyAnchorRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  const handleDownload = useCallback(async (row: RespondentReportHistoryRow) => {
    const notificationId = notify.loading("Preparando PDF…");
    try {
      const blob = await fetchCatalogReportPdf(row.downloadPath);
      downloadPdfBlob(blob, reportFilename(row));
      notify.success("Download iniciado.", { id: notificationId });
    } catch (error) {
      notify.error(describeError(error, "Não foi possível baixar o PDF."), { id: notificationId });
    }
  }, []);

  const handleOpen = useCallback(async (row: RespondentReportHistoryRow) => {
    const notificationId = notify.loading("Abrindo PDF…");
    try {
      const blob = await fetchCatalogReportPdf(row.downloadPath);
      const opened = openPdfBlob(blob, reportFilename(row));
      notify.success(opened ? "PDF aberto em nova aba." : "Download iniciado.", {
        id: notificationId,
      });
    } catch (error) {
      notify.error(describeError(error, "Não foi possível abrir o PDF."), { id: notificationId });
    }
  }, []);

  const bimonthlyOriginHref = respondentFamiPath({
    cycleId: filters.cycleId || undefined,
    tab: "evolucao",
  });

  return (
    <div className={layout.pageStack}>
      <div className={RESPONDENT_PAGE_HERO_BLEED}>
        <RespondentReportsHero
          loading={loading}
          onRefresh={() => void refresh()}
          onScrollHistory={scrollHistory}
        />
      </div>

      <section className={layout.panelStack}>
        <PanelSection
          title={reportCatalogLabels.historyTitle}
          description={reportCatalogLabels.historyDescription}
          variant="plain"
          id="relatorios-historico"
          contentClassName="space-y-4"
        >
          <div ref={historyAnchorRef} className="scroll-mt-4 space-y-4">
            <RespondentReportsFilters
              value={filters}
              onChange={setFilters}
              onClear={() => setFilters(INITIAL_HISTORY_FILTERS)}
              availableYears={reportHistoryYears}
            />

            {filters.cycleId ? (
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 bg-slate-50/60 px-4 py-3">
                <p className="text-sm text-slate-700">{reportCatalogLabels.cycleScopeLabel}</p>
                <button
                  type="button"
                  className={formSurface.secondaryButtonSm}
                  onClick={() => setFilters({ ...filters, cycleId: "" })}
                >
                  {reportCatalogLabels.clearCycleScope}
                </button>
              </div>
            ) : null}

            {historyError ? (
              <AsyncErrorState
                message={historyError}
                title={history.length > 0 ? "Não foi possível atualizar o histórico" : undefined}
                onRetry={refresh}
                retrying={loading}
                compact={history.length > 0}
              />
            ) : null}

            {filteredHistory.length === 0 && history.length > 0 ? (
              <RespondentReportsEmptyState variant="no-filter-results" />
            ) : (
              <RespondentReportsHistoryList
                items={filteredHistory}
                onDownload={(row) => void handleDownload(row)}
                onOpen={(row) => void handleOpen(row)}
                emptyKind={filters.kind}
                emptyOriginHref={bimonthlyOriginHref}
              />
            )}

            {total > pageSize ? (
              <nav className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4" aria-label="Paginação do histórico de relatórios">
                <p className="text-xs text-slate-500">
                  Exibindo {Math.min(offset + 1, total)}–{Math.min(offset + pageSize, total)} de {total} emissões
                </p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
                    onClick={previousPage}
                    disabled={loading || offset === 0}
                  >
                    Anterior
                  </button>
                  <button
                    type="button"
                    className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
                    onClick={nextPage}
                    disabled={loading || !hasMore}
                  >
                    Próxima
                  </button>
                </div>
              </nav>
            ) : null}
          </div>
        </PanelSection>
      </section>
    </div>
  );
}
