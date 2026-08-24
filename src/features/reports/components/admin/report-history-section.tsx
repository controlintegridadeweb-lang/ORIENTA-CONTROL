import { Download, FileText } from "lucide-react";
import { AsyncErrorState } from "@/shared/ui/components/async-error-state";
import { EmptyState } from "@/shared/ui/components/empty-state";
import { PanelSection } from "@/shared/ui/components/panel-section";
import { formSurface } from "@/shared/layout/form-surface";
import { typography } from "@/shared/layout/design-system";
import type { ReportHistoryOption } from "@/features/reports/ui/client";
import { formatReportDate } from "./report-shell-display";
import { REPORT_HISTORY_PAGE_SIZE } from "./reports-controller-model";
import type { ReportsController } from "./use-reports-controller";

function ReportHistoryItem({
  report,
  onDownload,
}: {
  report: ReportHistoryOption;
  onDownload: (report: ReportHistoryOption) => void;
}) {
  return (
    <li className={`${formSurface.entityListCard} p-4 sm:p-5`}>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 flex-1 items-start gap-4">
          <span
            className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-50 text-brand-800"
            aria-hidden
          >
            <FileText className="h-5 w-5" />
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className={typography.cardTitle}>{report.formName}</h3>
              <span className={`${formSurface.badge.base} ${formSurface.badge.brand}`}>
                Emissão v{report.emissionVersion}
              </span>
              {!report.isCurrent ? (
                <span className={`${formSurface.badge.base} ${formSurface.badge.warning}`}>
                  Versão anterior
                </span>
              ) : null}
            </div>
            <p className={`mt-1 ${typography.cardDescription}`}>
              {report.periodLabel || "Sem período"}
              {" · "}
              <time dateTime={report.generatedAt}>{formatReportDate(report.generatedAt)}</time>
              {" · "}
              {report.generatedByLabel}
            </p>
            <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-3">
              <div>
                <dt className={typography.meta}>Processamento</dt>
                <dd className="mt-0.5 text-slate-700">nº {report.processingVersion}</dd>
              </div>
              <div>
                <dt className={typography.meta}>Política FAMI</dt>
                <dd className="mt-0.5 text-slate-700">{report.policyVersion}</dd>
              </div>
              {report.fileSha256 ? (
                <div className="min-w-0 sm:col-span-2 lg:col-span-1">
                  <dt className={typography.meta}>SHA-256</dt>
                  <dd className="mt-0.5 truncate font-mono text-slate-700" title={report.fileSha256}>
                    {report.fileSha256.slice(0, 16)}…
                  </dd>
                </div>
              ) : null}
            </dl>
            {report.reissueReason ? (
              <p className={`mt-3 ${typography.auxiliary}`}>
                Motivo da reemissão: {report.reissueReason}
              </p>
            ) : null}
            {report.outdatedReason ? (
              <p className="mt-3 text-sm font-medium text-amber-800">{report.outdatedReason}</p>
            ) : null}
          </div>
        </div>
        <button
          type="button"
          className={`${formSurface.secondaryButtonSm} w-full shrink-0 sm:w-auto`}
          onClick={() => onDownload(report)}
        >
          <Download className="h-4 w-4" aria-hidden />
          Baixar
        </button>
      </div>
    </li>
  );
}

export function ReportHistorySection({ controller }: { controller: ReportsController }) {
  const { state, loadHistory, changeHistoryPage, download } = controller;

  return (
    <PanelSection
      title="Histórico de emissões"
      description="Cada versão mantém arquivo, data, autor e motivo próprios. Emissões de diagnósticos reabertos continuam disponíveis apenas como histórico."
      variant="plain"
    >
      {state.historyError ? (
        <AsyncErrorState
          message={state.historyError}
          title={state.history.length > 0 ? "Não foi possível atualizar o histórico" : undefined}
          onRetry={() => loadHistory(
            state.organizationId,
            state.cycleId,
            state.historyOffset,
          )}
          retrying={state.loadingHistory}
          compact={state.history.length > 0}
          className="mb-4"
        />
      ) : null}
      {!state.organizationId ? (
        <p className={typography.auxiliary}>Selecione uma organização para consultar o histórico.</p>
      ) : state.loadingHistory ? (
        <p className={typography.auxiliary}>Carregando histórico...</p>
      ) : state.history.length === 0 ? (
        <EmptyState
          icon={FileText}
          title="Nenhuma emissão registrada"
          description="Não há PDF oficial para o filtro atual. A primeira emissão ocorre no encerramento do diagnóstico."
        />
      ) : (
        <>
          <ul className="space-y-3" role="list" aria-label="Histórico de emissões">
            {state.history.map((report) => (
              <ReportHistoryItem
                key={report.id}
                report={report}
                onDownload={(item) => void download(item)}
              />
            ))}
          </ul>
          {state.historyTotal > REPORT_HISTORY_PAGE_SIZE ? (
            <nav
              className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4"
              aria-label="Paginação do histórico de emissões"
            >
              <p className={typography.meta}>
                Exibindo {Math.min(state.historyOffset + 1, state.historyTotal)}–{Math.min(state.historyOffset + REPORT_HISTORY_PAGE_SIZE, state.historyTotal)} de {state.historyTotal} emissões
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  className={formSurface.secondaryButtonSm}
                  onClick={() => changeHistoryPage(
                    Math.max(0, state.historyOffset - REPORT_HISTORY_PAGE_SIZE),
                  )}
                  disabled={state.historyOffset === 0 || state.loadingHistory}
                >
                  Anterior
                </button>
                <button
                  type="button"
                  className={formSurface.secondaryButtonSm}
                  onClick={() => changeHistoryPage(
                    state.historyOffset + REPORT_HISTORY_PAGE_SIZE,
                  )}
                  disabled={!state.historyHasMore || state.loadingHistory}
                >
                  Próxima
                </button>
              </div>
            </nav>
          ) : null}
        </>
      )}
    </PanelSection>
  );
}
