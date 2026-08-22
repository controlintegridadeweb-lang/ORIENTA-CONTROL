import { Download, FileText } from "lucide-react";
import { AsyncErrorState } from "@/shared/ui/components/async-error-state";
import { PanelSection } from "@/shared/ui/components/panel-section";
import { formSurface } from "@/shared/layout/form-surface";
import { formatReportDate } from "./report-shell-display";
import {
  REPORT_HISTORY_PAGE_SIZE,
} from "./reports-controller-model";
import type { ReportsController } from "./use-reports-controller";

export function ReportHistorySection({ controller }: { controller: ReportsController }) {
  const { state, loadHistory, changeHistoryPage, download } = controller;

  return (
    <PanelSection
      title="Histórico de emissões"
      description="Cada versão mantém arquivo, data, autor e motivo próprios. Emissões de diagnósticos reabertos continuam disponíveis apenas como histórico."
      variant="card"
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
        <p className="text-sm text-slate-500">Selecione uma organização para consultar o histórico.</p>
      ) : state.loadingHistory ? (
        <p className="text-sm text-slate-500">Carregando histórico...</p>
      ) : state.history.length === 0 ? (
        <p className="text-sm text-slate-500">Nenhuma emissão registrada para este filtro.</p>
      ) : (
        <>
          <ul className="divide-y divide-slate-100" role="list" aria-label="Histórico de emissões">
            {state.history.map((report) => (
              <li
                key={report.id}
                className="flex flex-col gap-3 py-4 first:pt-0 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <p className="flex flex-wrap items-center gap-2 text-sm font-semibold text-slate-900">
                    <FileText className="h-4 w-4 text-slate-400" aria-hidden />
                    {report.formName}
                    <span className="rounded bg-slate-100 px-1.5 py-0.5 text-2xs font-semibold text-slate-600">
                      Emissão v{report.emissionVersion}
                    </span>
                    <span className="rounded bg-slate-50 px-1.5 py-0.5 text-2xs text-slate-500">
                      Processamento nº {report.processingVersion}
                    </span>
                    <span className="rounded bg-slate-50 px-1.5 py-0.5 text-2xs text-slate-500">
                      Política FAMI {report.policyVersion}
                    </span>
                    {!report.isCurrent ? (
                      <span className="rounded bg-amber-50 px-1.5 py-0.5 text-2xs font-semibold text-amber-700">
                        Versão anterior
                      </span>
                    ) : null}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    {report.periodLabel || "Sem período"} · {formatReportDate(report.generatedAt)} · {report.generatedByLabel}
                  </p>
                  {report.reissueReason ? (
                    <p className="mt-1 text-xs text-slate-600">Motivo da reemissão: {report.reissueReason}</p>
                  ) : null}
                  {report.outdatedReason ? (
                    <p className="mt-1 text-xs font-medium text-amber-700">{report.outdatedReason}</p>
                  ) : null}
                  {report.fileSha256 ? (
                    <p className="mt-1 font-mono text-2xs text-slate-400" title={report.fileSha256}>
                      Integridade SHA-256: {report.fileSha256.slice(0, 16)}…
                    </p>
                  ) : null}
                </div>
                <button
                  type="button"
                  className={`${formSurface.secondaryButtonSm} shrink-0`}
                  onClick={() => void download(report)}
                >
                  <Download className="h-3.5 w-3.5" aria-hidden />
                  Baixar
                </button>
              </li>
            ))}
          </ul>
          {state.historyTotal > REPORT_HISTORY_PAGE_SIZE ? (
            <nav
              className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4"
              aria-label="Paginação do histórico de emissões"
            >
              <p className="text-xs text-slate-500">
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
