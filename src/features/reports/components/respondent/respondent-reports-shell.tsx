"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { describeError, notify } from "@/infrastructure/notifications/notify";
import {
  downloadPdfBlob,
  fetchPersistedReportPdf,
} from "@/features/reports/ui/client";
import type { RespondentReportHistoryRow } from "@/features/reports/ui/respondent-presentation";
import { RespondentReportsHero } from "./respondent-reports-hero";
import { RESPONDENT_PAGE_HERO_BLEED } from "@/shared/layout/respondent-page-layout";
import {
  INITIAL_HISTORY_FILTERS,
  RespondentReportsFilters,
} from "./respondent-reports-filters";
import { RespondentReportsHistoryList } from "./respondent-reports-history-list";
import { RespondentReportsPreviewDrawer } from "./respondent-reports-preview-drawer";
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
  return `relatorio-orienta-${safeFormName || "diagnostico"}-processamento-${row.processingVersion}-emissao-${row.emissionVersion}-${row.id.slice(0, 8)}.pdf`;
}

/** Consulta documentos já emitidos pela administração. Nenhuma ação desta tela emite ou reemite PDF. */
export function RespondentReportsShell() {
  const historyAnchorRef = useRef<HTMLDivElement>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewRow, setPreviewRow] = useState<RespondentReportHistoryRow | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const previewUrlRef = useRef<string | null>(null);
  const previewRequestIdRef = useRef(0);

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
    const notificationId = notify.loading("Preparando PDF oficial…");
    try {
      const blob = await fetchPersistedReportPdf(row.downloadPath);
      downloadPdfBlob(blob, reportFilename(row));
      notify.success("Download iniciado.", { id: notificationId });
    } catch (error) {
      notify.error(describeError(error, "Não foi possível baixar o PDF oficial."), { id: notificationId });
    }
  }, []);

  const handleShare = useCallback(async (row: RespondentReportHistoryRow) => {
    const notificationId = notify.loading("Preparando arquivo para compartilhamento…");
    try {
      const blob = await fetchPersistedReportPdf(row.downloadPath);
      const file = new File([blob], reportFilename(row), { type: "application/pdf" });
      if (navigator.share && navigator.canShare?.({ files: [file] })) {
        await navigator.share({
          title: "Relatório Orienta",
          text: `${row.formName} · Processamento nº ${row.processingVersion} · Política FAMI ${row.policyVersion}`,
          files: [file],
        });
        notify.success("Compartilhamento iniciado.", { id: notificationId });
        return;
      }
      downloadPdfBlob(blob, reportFilename(row));
      notify.success("Seu navegador não oferece compartilhamento de arquivos. O download foi iniciado.", {
        id: notificationId,
      });
    } catch (error) {
      notify.error(describeError(error, "Não foi possível compartilhar o PDF oficial."), {
        id: notificationId,
      });
    }
  }, []);

  const releasePreviewUrl = useCallback(() => {
    if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
    previewUrlRef.current = null;
    setPreviewUrl(null);
  }, []);

  const openPreview = useCallback((row: RespondentReportHistoryRow) => {
    const requestId = ++previewRequestIdRef.current;
    setPreviewRow(row);
    setPreviewOpen(true);
    setPreviewLoading(true);
    releasePreviewUrl();

    void (async () => {
      try {
        const blob = await fetchPersistedReportPdf(row.downloadPath);
        const nextUrl = URL.createObjectURL(blob);
        if (requestId !== previewRequestIdRef.current) {
          URL.revokeObjectURL(nextUrl);
          return;
        }
        previewUrlRef.current = nextUrl;
        setPreviewUrl(nextUrl);
      } catch (error) {
        if (requestId === previewRequestIdRef.current) {
          notify.error(describeError(error, "Não foi possível carregar a pré-visualização."));
        }
      } finally {
        if (requestId === previewRequestIdRef.current) setPreviewLoading(false);
      }
    })();
  }, [releasePreviewUrl]);

  const closePreview = useCallback(() => {
    previewRequestIdRef.current += 1;
    setPreviewOpen(false);
    setPreviewRow(null);
    setPreviewLoading(false);
    releasePreviewUrl();
  }, [releasePreviewUrl]);

  useEffect(
    () => () => {
      previewRequestIdRef.current += 1;
      if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
      previewUrlRef.current = null;
    },
    [],
  );

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
          title="Histórico de relatórios"
          description="Consulte as emissões oficiais disponíveis para sua organização."
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
                onPreview={openPreview}
                onShare={(row) => void handleShare(row)}
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

        <RespondentReportsPreviewDrawer
          open={previewOpen}
          onClose={closePreview}
          row={previewRow}
          previewUrl={previewUrl}
          previewLoading={previewLoading}
          onDownload={() => {
            if (previewRow) void handleDownload(previewRow);
          }}
        />
      </section>
    </div>
  );
}
