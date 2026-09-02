import Link from "next/link";
import { Download, FileText } from "lucide-react";
import { AsyncErrorState } from "@/shared/ui/components/async-error-state";
import { EmptyState } from "@/shared/ui/components/empty-state";
import { PanelSection } from "@/shared/ui/components/panel-section";
import { formSurface } from "@/shared/layout/form-surface";
import { typography } from "@/shared/layout/design-system";
import type { ReportHistoryOption } from "@/features/reports/ui/client";
import { catalogKindLabel } from "@/features/reports/report-catalog";
import { reportCatalogLabels } from "@/shared/labels/official-labels";
import { adminFamiPath } from "@/shared/navigation/fami-paths";
import { formatReportDate } from "./report-shell-display";
import { REPORT_HISTORY_PAGE_SIZE } from "./reports-controller-model";
import type { ReportsController } from "./use-reports-controller";

const HISTORY_META_LABEL = "text-xs text-slate-600";
const HISTORY_META_VALUE = "mt-0.5 font-medium text-slate-900";

function ReportHistoryItem({
  report,
  onDownload,
}: {
  report: ReportHistoryOption;
  onDownload: (report: ReportHistoryOption) => void;
}) {
  return (
    <li className={`${formSurface.entityListCard} overflow-hidden`}>
      <div className="flex flex-col gap-3 border-b border-slate-100 px-4 py-4 sm:flex-row sm:items-start sm:justify-between sm:px-5">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className={typography.cardTitle}>{report.formName}</h3>
            <span
              className={`${formSurface.badge.base} ${
                report.catalogKind === "bimonthly" ? formSurface.badge.info : formSurface.badge.brand
              }`}
            >
              {catalogKindLabel(report.catalogKind, report.referenceStartYear)}
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
        </div>
        <button
          type="button"
          className={`${formSurface.secondaryButtonSm} w-full shrink-0 sm:w-auto`}
          onClick={() => onDownload(report)}
        >
          <Download className="h-3.5 w-3.5" aria-hidden />
          Baixar
        </button>
      </div>

      <dl className="grid gap-4 bg-slate-50/60 px-4 py-4 text-sm sm:grid-cols-2 sm:px-5 lg:grid-cols-4">
        <div>
          <dt className={HISTORY_META_LABEL}>Emissão</dt>
          <dd className={HISTORY_META_VALUE}>v{report.emissionVersion}</dd>
        </div>
        {report.catalogKind === "bimonthly" && report.bimester != null ? (
          <div>
            <dt className={HISTORY_META_LABEL}>Bimestre</dt>
            <dd className={HISTORY_META_VALUE}>{report.bimester}º</dd>
          </div>
        ) : (
          <div>
            <dt className={HISTORY_META_LABEL}>Processamento</dt>
            <dd className={HISTORY_META_VALUE}>nº {report.processingVersion}</dd>
          </div>
        )}
        {report.catalogKind === "annual" ? (
          <div>
            <dt className={HISTORY_META_LABEL}>Política FAMI</dt>
            <dd className={HISTORY_META_VALUE}>{report.policyVersion}</dd>
          </div>
        ) : null}
        {report.fileSha256 ? (
          <div className="min-w-0">
            <dt className={HISTORY_META_LABEL}>SHA-256</dt>
            <dd
              className="mt-0.5 truncate font-mono text-xs font-medium text-slate-900"
              title={report.fileSha256}
            >
              {report.fileSha256.slice(0, 16)}…
            </dd>
          </div>
        ) : null}
      </dl>

      {report.reissueReason || report.outdatedReason ? (
        <div className="space-y-1.5 border-t border-slate-100 px-4 py-3 sm:px-5">
          {report.reissueReason ? (
            <p className={typography.auxiliary}>
              Motivo da reemissão: {report.reissueReason}
            </p>
          ) : null}
          {report.outdatedReason ? (
            <p className="text-sm font-medium text-amber-800">{report.outdatedReason}</p>
          ) : null}
        </div>
      ) : null}
    </li>
  );
}

function historyDescription(kind: "" | "annual" | "bimonthly"): string {
  if (kind === "annual") return reportCatalogLabels.annualHint;
  if (kind === "bimonthly") return reportCatalogLabels.bimonthlyHint;
  return reportCatalogLabels.historyDescription;
}

function historyEmptyDescription(kind: "" | "annual" | "bimonthly"): string {
  if (kind === "annual") return reportCatalogLabels.emptyAnnualDescription;
  if (kind === "bimonthly") return reportCatalogLabels.emptyBimonthlyDescription;
  return reportCatalogLabels.adminEmptyDescription;
}

export function ReportHistorySection({ controller }: { controller: ReportsController }) {
  const { state, loadHistory, changeHistoryPage, changeHistoryKind, download } = controller;
  const bimonthlyOriginHref = adminFamiPath({
    organizationId: state.organizationId || undefined,
    cycleId: state.cycleId || undefined,
    tab: "evolucao",
  });

  return (
    <PanelSection
      title={reportCatalogLabels.historyTitle}
      description={historyDescription(state.historyKind)}
      variant="plain"
    >
      <label className={`${formSurface.fieldGroup} mb-4 max-w-xs`}>
        <span className={formSurface.label}>{reportCatalogLabels.typeFilter}</span>
        <select
          value={state.historyKind}
          onChange={(event) =>
            changeHistoryKind(event.target.value as "" | "annual" | "bimonthly")
          }
          className={formSurface.inputSelect}
          disabled={state.loadingHistory}
        >
          <option value="">{reportCatalogLabels.allTypes}</option>
          <option value="annual">{reportCatalogLabels.annual}</option>
          <option value="bimonthly">{reportCatalogLabels.bimonthly}</option>
        </select>
      </label>
      {state.historyError ? (
        <AsyncErrorState
          message={state.historyError}
          title={state.history.length > 0 ? "Não foi possível atualizar o histórico" : undefined}
          onRetry={() => loadHistory(
            state.organizationId,
            state.cycleId,
            state.historyOffset,
            state.historyKind,
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
          title={reportCatalogLabels.emptyTitle}
          description={historyEmptyDescription(state.historyKind)}
          action={
            state.historyKind === "annual" ? null : (
              <Link href={bimonthlyOriginHref} className={formSurface.secondaryButtonSm}>
                {reportCatalogLabels.bimonthlyOriginCta}
              </Link>
            )
          }
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
